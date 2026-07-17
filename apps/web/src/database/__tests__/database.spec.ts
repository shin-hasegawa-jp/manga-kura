// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DATABASE_NAME, DATABASE_VERSION, MangaKuraDatabase } from '../database'
import { createDevelopmentComicFixture } from '../developmentComicFixture'
import { createComicRegistrationService } from '../registrationService'
import { createMangaRepository } from '../repository'

const databases: MangaKuraDatabase[] = []

function createTestDatabase(): MangaKuraDatabase {
  const database = new MangaKuraDatabase(`${DATABASE_NAME}-test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

describe('MangaKuraDatabase', () => {
  it('設定済みのデータベース名とスキーマバージョンを使用する', () => {
    const database = new MangaKuraDatabase()

    expect(database.name).toBe(DATABASE_NAME)
    expect(database.verno).toBe(DATABASE_VERSION)

    database.close()
  })

  it('必要なストア、主キー、インデックスを定義する', async () => {
    const database = createTestDatabase()
    await database.open()

    expect(database.tables.map((table) => table.name).sort()).toEqual([
      'episodes',
      'images',
      'series',
      'settings',
    ])
    expect(database.series.schema.primKey.name).toBe('id')
    expect(database.episodes.schema.primKey.name).toBe('id')
    expect(database.images.schema.primKey.name).toBe('id')
    expect(database.settings.schema.primKey.name).toBe('id')
    expect(database.episodes.schema.indexes.map((index) => index.name)).toContain('seriesId')
    expect(database.images.schema.indexes.map((index) => index.name)).toContain(
      '[episodeId+displayOrder]',
    )
  })

  it('実行時バリデーションに失敗したデータを保存しない', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)

    await expect(repository.series.save({ id: 'invalid-series' })).rejects.toThrow()
    expect(await database.series.count()).toBe(0)
  })

  it('開発用の作品と話のFixtureを重複させずに保存・読込する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()

    await repository.series.save(fixture.series)
    await repository.episodes.save(fixture.episode)

    expect(await repository.series.findById(fixture.series.id)).toEqual(fixture.series)
    expect(await repository.episodes.findById(fixture.episode.id)).toEqual(fixture.episode)
    expect(await repository.episodes.findAll()).toEqual([fixture.episode])

    const repeatedFixture = createDevelopmentComicFixture()
    await repository.series.save(repeatedFixture.series)
    await repository.episodes.save(repeatedFixture.episode)

    expect(await database.series.count()).toBe(1)
    expect(await database.episodes.count()).toBe(1)
    expect(await repository.series.findById(repeatedFixture.series.id)).toEqual(
      repeatedFixture.series,
    )
    expect(await repository.episodes.findById(repeatedFixture.episode.id)).toEqual(
      repeatedFixture.episode,
    )
  })

  it('元ページURLで作品に属する話と単独の話を検索し、未登録URLでは何も返さない', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '単独の話',
      sourcePageUrl: 'https://example.com/standalone-episodes/1',
    }

    await repository.episodes.save(fixture.episode)
    await repository.episodes.save(standaloneEpisode)

    expect(await repository.episodes.findBySourcePageUrl(fixture.episode.sourcePageUrl)).toEqual(
      fixture.episode,
    )
    expect(await repository.episodes.findBySourcePageUrl(standaloneEpisode.sourcePageUrl)).toEqual(
      standaloneEpisode,
    )
    expect(
      await repository.episodes.findBySourcePageUrl('https://example.com/not-registered'),
    ).toBeUndefined()
  })

  it('新規作品と最初の話と固定画像を同じトランザクションで保存する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const registeredAt = new Date('2026-07-17T01:00:00.000Z')
    const identifiers = ['series-1', 'episode-1']
    const service = createComicRegistrationService(database, {
      createId: () => {
        const identifier = identifiers.shift()

        if (identifier === undefined) {
          throw new Error('IDが不足しています')
        }

        return identifier
      },
      now: () => registeredAt,
    })

    const registered = await service.registerSeriesWithFirstEpisode({
      registration: {
        seriesTitle: '新規作品',
        title: '第1話',
        sourcePageUrl: 'https://example.com/new-series/episodes/1',
      },
      image: fixture.image,
    })

    expect(registered.series).toEqual({
      id: 'series-1',
      title: '新規作品',
      createdAt: registeredAt,
      updatedAt: registeredAt,
      episodeCount: 1,
    })
    expect(registered.episode).toEqual({
      id: 'episode-1',
      seriesId: 'series-1',
      title: '第1話',
      sourcePageUrl: 'https://example.com/new-series/episodes/1',
      createdAt: registeredAt,
      updatedAt: registeredAt,
      scrollPosition: 0,
      scrollProgress: 0,
    })
    expect(registered.image).toEqual({
      ...fixture.image,
      episodeId: 'episode-1',
      createdAt: registeredAt,
    })
    expect(await repository.series.findById(registered.series.id)).toEqual(registered.series)
    expect(await repository.episodes.findById(registered.episode.id)).toEqual(registered.episode)
    expect(await repository.images.findByEpisodeId(registered.episode.id)).toEqual([
      registered.image,
    ])
  })

  it('画像の保存に失敗した場合は作品と話を保存せずにロールバックする', async () => {
    const database = createTestDatabase()
    const fixture = createDevelopmentComicFixture()
    const identifiers = ['series-rollback', 'episode-rollback']
    const service = createComicRegistrationService(database, {
      createId: () => {
        const identifier = identifiers.shift()

        if (identifier === undefined) {
          throw new Error('IDが不足しています')
        }

        return identifier
      },
    })

    await expect(
      service.registerSeriesWithFirstEpisode({
        registration: {
          seriesTitle: 'ロールバック確認用作品',
          title: '第1話',
          sourcePageUrl: 'https://example.com/rollback/episodes/1',
        },
        image: { ...fixture.image, width: 0 },
      }),
    ).rejects.toThrow()

    expect(await database.series.count()).toBe(0)
    expect(await database.episodes.count()).toBe(0)
    expect(await database.images.count()).toBe(0)
  })

  it('単独の話と固定画像を保存し、作品一覧を経由せずに読込できる', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const registeredAt = new Date('2026-07-17T02:00:00.000Z')
    const service = createComicRegistrationService(database, {
      createId: () => 'standalone-episode-1',
      now: () => registeredAt,
    })

    const registered = await service.registerStandaloneEpisode({
      registration: {
        title: '単独の話',
        sourcePageUrl: 'https://example.com/standalone-episodes/1',
      },
      image: fixture.image,
    })

    expect(await database.series.count()).toBe(0)
    expect(registered.episode).toEqual({
      id: 'standalone-episode-1',
      title: '単独の話',
      sourcePageUrl: 'https://example.com/standalone-episodes/1',
      createdAt: registeredAt,
      updatedAt: registeredAt,
      scrollPosition: 0,
      scrollProgress: 0,
    })
    expect(await repository.episodes.findById(registered.episode.id)).toEqual(registered.episode)
    expect(await repository.images.findByEpisodeId(registered.episode.id)).toEqual([
      registered.image,
    ])
  })

  it('開発用画像のBlobを表示順に保存・読込する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const secondImage = {
      ...fixture.image,
      id: 'development-image-2',
      displayOrder: 1,
      sourceUrl: 'https://example.com/development-series/episodes/1/images/2.png',
    }

    await repository.images.save(secondImage)
    await repository.images.save(fixture.image)

    const images = await repository.images.findByEpisodeId(fixture.episode.id)

    expect(images.map((image) => image.id)).toEqual([fixture.image.id, secondImage.id])
    expect(images[0]).toMatchObject({
      id: fixture.image.id,
      episodeId: fixture.episode.id,
      displayOrder: fixture.image.displayOrder,
      sourceUrl: fixture.image.sourceUrl,
      mimeType: fixture.image.mimeType,
      fileSize: fixture.image.fileSize,
      width: fixture.image.width,
      height: fixture.image.height,
      createdAt: fixture.image.createdAt,
    })
    expect(images[0]?.blob.type).toBe(fixture.image.blob.type)
    expect(await images[0]?.blob.arrayBuffer()).toEqual(await fixture.image.blob.arrayBuffer())
  })
})
