// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DATABASE_NAME, DATABASE_VERSION, MangaKuraDatabase } from '../database'
import { createDevelopmentComicFixture } from '../developmentComicFixture'
import {
  createComicRegistrationService,
  createRegistrationId,
  createRegistrationImages,
} from '../registrationService'
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

  it('登録用の識別子を生成する', () => {
    expect(createRegistrationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('取得済み画像群へIDと選択順の表示順を割り当てる', () => {
    const fixture = createDevelopmentComicFixture()
    const identifiers = ['fetched-image-1', 'fetched-image-2']
    const images = createRegistrationImages(
      [
        fixture.image,
        {
          ...fixture.image,
          sourceUrl: 'https://example.com/images/page02.png',
        },
      ],
      () => identifiers.shift() ?? 'unexpected-image-id',
    )

    expect(
      images.map(({ id, displayOrder, sourceUrl }) => ({ id, displayOrder, sourceUrl })),
    ).toEqual([
      {
        id: 'fetched-image-1',
        displayOrder: 0,
        sourceUrl: fixture.image.sourceUrl,
      },
      {
        id: 'fetched-image-2',
        displayOrder: 1,
        sourceUrl: 'https://example.com/images/page02.png',
      },
    ])
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

  it('作品に属する話と単独の話を共通のライブラリ一覧モデルとして読込する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      id: 'standalone-episode-1',
      title: '単独の話',
      sourcePageUrl: 'https://example.com/standalone-episodes/1',
      createdAt: fixture.episode.createdAt,
      updatedAt: fixture.episode.updatedAt,
      scrollPosition: 0,
      scrollProgress: 0,
    }
    const laterImage = {
      ...fixture.image,
      id: 'development-image-2',
      displayOrder: 1,
    }

    expect(await repository.library.findAll()).toEqual([])

    await repository.series.save(fixture.series)
    await repository.episodes.save(fixture.episode)
    await repository.episodes.save(standaloneEpisode)
    await repository.images.save(laterImage)
    await repository.images.save(fixture.image)

    expect(await repository.library.findAll()).toEqual([
      { episode: fixture.episode, series: fixture.series, thumbnailImage: fixture.image },
      { episode: standaloneEpisode },
    ])
  })

  it('作品を集約し、単独の話と同じトップ一覧モデルとして読込する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const secondEpisode = {
      ...fixture.episode,
      id: 'development-episode-2',
      title: '第2話',
      episodeNumber: 2,
      sourcePageUrl: 'https://example.com/development-series/episodes/2',
    }
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '単独の話',
      episodeNumber: undefined,
      sourcePageUrl: 'https://example.com/standalone-episodes/1',
    }
    const standaloneImage = {
      ...fixture.image,
      id: 'standalone-image-1',
      episodeId: standaloneEpisode.id,
      sourceUrl: 'https://example.com/standalone-episodes/1/images/1.png',
    }
    const laterSeriesImage = {
      ...fixture.image,
      id: 'development-image-2',
      episodeId: secondEpisode.id,
      sourceUrl: 'https://example.com/development-series/episodes/2/images/1.png',
    }

    await repository.series.save({ ...fixture.series, episodeCount: 2 })
    await repository.episodes.save(secondEpisode)
    await repository.episodes.save(fixture.episode)
    await repository.episodes.save(standaloneEpisode)
    await repository.images.save(laterSeriesImage)
    await repository.images.save(fixture.image)
    await repository.images.save(standaloneImage)

    expect(await repository.topLevelLibrary.findAll()).toEqual([
      {
        kind: 'series',
        series: { ...fixture.series, episodeCount: 2 },
        episodeCount: 2,
        thumbnailImage: fixture.image,
      },
      {
        kind: 'standaloneEpisode',
        episode: standaloneEpisode,
        thumbnailImage: standaloneImage,
      },
    ])
  })

  it('画像や所属する話がないデータもトップ一覧モデルとして読込する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const emptySeries = {
      ...fixture.series,
      id: 'empty-series',
      title: '話がない作品',
      episodeCount: 0,
    }
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-without-image',
      seriesId: undefined,
      title: '画像がない単独の話',
      sourcePageUrl: 'https://example.com/standalone-without-image',
    }

    await repository.series.save(emptySeries)
    await repository.episodes.save(standaloneEpisode)

    expect(await repository.topLevelLibrary.findAll()).toEqual([
      { kind: 'series', series: emptySeries, episodeCount: 0 },
      { kind: 'standaloneEpisode', episode: standaloneEpisode },
    ])
  })

  it('指定した作品と所属する話だけを話数順で読込する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const secondEpisode = {
      ...fixture.episode,
      id: 'development-episode-2',
      title: '第2話',
      episodeNumber: 2,
      sourcePageUrl: 'https://example.com/development-series/episodes/2',
    }
    const unnumberedEpisode = {
      ...fixture.episode,
      id: 'development-extra-episode',
      title: '番外編',
      episodeNumber: undefined,
      sourcePageUrl: 'https://example.com/development-series/episodes/extra',
      createdAt: new Date('2026-07-18T00:00:00.000Z'),
      updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    }
    const laterUnnumberedEpisode = {
      ...unnumberedEpisode,
      id: 'development-later-extra-episode',
      title: '後日談',
      sourcePageUrl: 'https://example.com/development-series/episodes/after-story',
      createdAt: new Date('2026-07-19T00:00:00.000Z'),
      updatedAt: new Date('2026-07-19T00:00:00.000Z'),
    }
    const otherSeries = {
      ...fixture.series,
      id: 'other-series',
      title: '別作品',
    }
    const otherSeriesEpisode = {
      ...fixture.episode,
      id: 'other-series-episode',
      seriesId: otherSeries.id,
      title: '別作品の第1話',
      sourcePageUrl: 'https://example.com/other-series/episodes/1',
    }
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode',
      seriesId: undefined,
      title: '単独の話',
      sourcePageUrl: 'https://example.com/standalone-episode',
    }
    const secondEpisodeImage = {
      ...fixture.image,
      id: 'development-image-2',
      episodeId: secondEpisode.id,
      sourceUrl: 'https://example.com/development-series/episodes/2/images/1.png',
    }

    await repository.series.save({ ...fixture.series, episodeCount: 4 })
    await repository.series.save(otherSeries)
    await repository.episodes.save(laterUnnumberedEpisode)
    await repository.episodes.save(unnumberedEpisode)
    await repository.episodes.save(secondEpisode)
    await repository.episodes.save(otherSeriesEpisode)
    await repository.episodes.save(standaloneEpisode)
    await repository.episodes.save(fixture.episode)
    await repository.images.save(secondEpisodeImage)
    await repository.images.save(fixture.image)

    expect(await repository.seriesDetails.findBySeriesId(fixture.series.id)).toEqual({
      series: { ...fixture.series, episodeCount: 4 },
      episodes: [
        { episode: fixture.episode, thumbnailImage: fixture.image },
        { episode: secondEpisode, thumbnailImage: secondEpisodeImage },
        { episode: unnumberedEpisode },
        { episode: laterUnnumberedEpisode },
      ],
    })
  })

  it('話がない作品では空の話一覧を返す', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const emptySeries = { ...fixture.series, episodeCount: 0 }

    await repository.series.save(emptySeries)

    expect(await repository.seriesDetails.findBySeriesId(emptySeries.id)).toEqual({
      series: emptySeries,
      episodes: [],
    })
  })

  it('存在しない作品IDでは作品内一覧を返さない', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)

    expect(await repository.seriesDetails.findBySeriesId('unknown-series')).toBeUndefined()
  })

  it('新規作品と最初の話と複数画像を同じトランザクションで保存する', async () => {
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

    const secondImage = {
      ...fixture.image,
      id: 'new-series-image-2',
      displayOrder: 99,
      sourceUrl: 'https://example.com/new-series/episodes/1/images/2.png',
    }
    const registered = await service.registerSeriesWithFirstEpisode({
      registration: {
        seriesTitle: '新規作品',
        title: '第1話',
        sourcePageUrl: 'https://example.com/new-series/episodes/1',
      },
      images: [secondImage, fixture.image],
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
    expect(registered.images).toEqual([
      {
        ...secondImage,
        displayOrder: 0,
        episodeId: 'episode-1',
        createdAt: registeredAt,
      },
      {
        ...fixture.image,
        displayOrder: 1,
        episodeId: 'episode-1',
        createdAt: registeredAt,
      },
    ])
    expect(await repository.series.findById(registered.series.id)).toEqual(registered.series)
    expect(await repository.episodes.findById(registered.episode.id)).toEqual(registered.episode)
    expect(await repository.images.findByEpisodeId(registered.episode.id)).toEqual([
      ...registered.images,
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
        images: [fixture.image, { ...fixture.image, id: 'invalid-image', width: 0 }],
      }),
    ).rejects.toThrow()

    expect(await database.series.count()).toBe(0)
    expect(await database.episodes.count()).toBe(0)
    expect(await database.images.count()).toBe(0)
  })

  it('単独の話と複数画像を保存し、作品一覧を経由せずに読込できる', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const registeredAt = new Date('2026-07-17T02:00:00.000Z')
    const service = createComicRegistrationService(database, {
      createId: () => 'standalone-episode-1',
      now: () => registeredAt,
    })

    const secondImage = {
      ...fixture.image,
      id: 'standalone-image-2',
      sourceUrl: 'https://example.com/standalone-episodes/1/images/2.png',
    }
    const registered = await service.registerStandaloneEpisode({
      registration: {
        title: '単独の話',
        sourcePageUrl: 'https://example.com/standalone-episodes/1',
      },
      images: [fixture.image, secondImage],
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
    expect(await repository.images.findByEpisodeId(registered.episode.id)).toEqual(
      registered.images,
    )
  })

  it('単独の話で途中の画像保存に失敗した場合は話と画像を残さない', async () => {
    const database = createTestDatabase()
    const fixture = createDevelopmentComicFixture()
    const service = createComicRegistrationService(database, {
      createId: () => 'failed-standalone-episode',
    })

    await expect(
      service.registerStandaloneEpisode({
        registration: {
          title: '保存に失敗する単独の話',
          sourcePageUrl: 'https://example.com/standalone-episodes/failed',
        },
        images: [fixture.image, { ...fixture.image, id: 'invalid-second-image', height: 0 }],
      }),
    ).rejects.toThrow()

    expect(await database.episodes.count()).toBe(0)
    expect(await database.images.count()).toBe(0)
  })

  it('既存作品へ話と複数画像を追加し、話数を更新する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const registeredAt = new Date('2026-07-17T03:00:00.000Z')
    const service = createComicRegistrationService(database, {
      createId: () => 'development-episode-2',
      now: () => registeredAt,
    })

    await repository.series.save(fixture.series)

    const secondImage = {
      ...fixture.image,
      id: 'development-image-3',
      sourceUrl: 'https://example.com/development-series/episodes/2/images/2.png',
    }
    const added = await service.addEpisodeToSeries({
      registration: {
        seriesId: fixture.series.id,
        title: '第2話',
        sourcePageUrl: 'https://example.com/development-series/episodes/2',
      },
      images: [{ ...fixture.image, id: 'development-image-2' }, secondImage],
    })

    expect(added.series).toEqual({
      ...fixture.series,
      episodeCount: 2,
      updatedAt: registeredAt,
    })
    expect(added.episode).toEqual({
      id: 'development-episode-2',
      seriesId: fixture.series.id,
      title: '第2話',
      sourcePageUrl: 'https://example.com/development-series/episodes/2',
      createdAt: registeredAt,
      updatedAt: registeredAt,
      scrollPosition: 0,
      scrollProgress: 0,
    })
    expect(await repository.series.findById(fixture.series.id)).toEqual(added.series)
    expect(await repository.episodes.findById(added.episode.id)).toEqual(added.episode)
    expect(await repository.images.findByEpisodeId(added.episode.id)).toEqual(added.images)
  })

  it('存在しない作品へ話を追加しない', async () => {
    const database = createTestDatabase()
    const fixture = createDevelopmentComicFixture()
    const service = createComicRegistrationService(database)

    await expect(
      service.addEpisodeToSeries({
        registration: {
          seriesId: 'unknown-series',
          title: '第1話',
          sourcePageUrl: 'https://example.com/unknown-series/episodes/1',
        },
        images: [fixture.image],
      }),
    ).rejects.toThrow('追加先の作品が見つかりません')

    expect(await database.series.count()).toBe(0)
    expect(await database.episodes.count()).toBe(0)
    expect(await database.images.count()).toBe(0)
  })

  it('追加する画像の保存に失敗した場合は作品の話数と保存済みデータを変えない', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const service = createComicRegistrationService(database, {
      createId: () => 'failed-episode',
    })

    await repository.series.save(fixture.series)
    await repository.episodes.save(fixture.episode)
    await repository.images.save(fixture.image)

    await expect(
      service.addEpisodeToSeries({
        registration: {
          seriesId: fixture.series.id,
          title: '失敗する話',
          sourcePageUrl: 'https://example.com/development-series/episodes/failed',
        },
        images: [
          { ...fixture.image, id: 'first-new-image' },
          { ...fixture.image, id: 'failed-image', width: 0 },
        ],
      }),
    ).rejects.toThrow()

    expect(await repository.series.findById(fixture.series.id)).toEqual(fixture.series)
    expect(await repository.episodes.findAll()).toEqual([fixture.episode])
    expect(await repository.images.findByEpisodeId(fixture.episode.id)).toEqual([fixture.image])
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

  it('保存した話と複数画像を一覧へ反映し、DB再接続後もBlobとメタデータを維持する', async () => {
    const database = createTestDatabase()
    const fixture = createDevelopmentComicFixture()
    const registeredAt = new Date('2026-07-18T06:00:00.000Z')
    const service = createComicRegistrationService(database, {
      createId: () => 'persisted-episode',
      now: () => registeredAt,
    })
    const firstImage = {
      ...fixture.image,
      id: 'persisted-image-1',
      displayOrder: 12,
      sourceUrl: 'https://cdn.example.com/comic/page01.png',
      width: 800,
      height: 1200,
    }
    const secondImageBytes = new Uint8Array([10, 20, 30, 40])
    const secondImage = {
      ...fixture.image,
      id: 'persisted-image-2',
      displayOrder: 3,
      blob: new Blob([secondImageBytes], { type: 'image/webp' }),
      sourceUrl: 'https://cdn.example.com/comic/page02.webp',
      mimeType: 'image/webp',
      fileSize: secondImageBytes.byteLength,
      width: 900,
      height: 1400,
    }

    const registered = await service.registerStandaloneEpisode({
      registration: {
        title: 'Frontend取得で保存した話',
        sourcePageUrl: 'https://example.com/comic/reader',
      },
      images: [firstImage, secondImage],
    })
    const repository = createMangaRepository(database)

    expect(await repository.topLevelLibrary.findAll()).toEqual([
      {
        kind: 'standaloneEpisode',
        episode: registered.episode,
        thumbnailImage: registered.images[0],
      },
    ])
    expect(
      (await repository.images.findByEpisodeId(registered.episode.id)).map(
        ({ id, displayOrder }) => ({ id, displayOrder }),
      ),
    ).toEqual([
      { id: 'persisted-image-1', displayOrder: 0 },
      { id: 'persisted-image-2', displayOrder: 1 },
    ])

    database.close()
    const reopenedDatabase = new MangaKuraDatabase(database.name)
    const reopenedRepository = createMangaRepository(reopenedDatabase)
    const persistedEpisode = await reopenedRepository.episodes.findById(registered.episode.id)
    const persistedImages = await reopenedRepository.images.findByEpisodeId(registered.episode.id)

    expect(persistedEpisode).toEqual(registered.episode)
    expect(
      persistedImages.map(
        ({ id, displayOrder, sourceUrl, mimeType, fileSize, width, height, createdAt }) => ({
          id,
          displayOrder,
          sourceUrl,
          mimeType,
          fileSize,
          width,
          height,
          createdAt,
        }),
      ),
    ).toEqual(
      registered.images.map(
        ({ id, displayOrder, sourceUrl, mimeType, fileSize, width, height, createdAt }) => ({
          id,
          displayOrder,
          sourceUrl,
          mimeType,
          fileSize,
          width,
          height,
          createdAt,
        }),
      ),
    )
    const persistedFirstImage = persistedImages.find(({ id }) => id === 'persisted-image-1')
    const persistedSecondImage = persistedImages.find(({ id }) => id === 'persisted-image-2')
    if (persistedFirstImage === undefined || persistedSecondImage === undefined) {
      throw new Error('再接続後の画像が不足しています')
    }

    expect(await persistedFirstImage.blob.arrayBuffer()).toEqual(
      await firstImage.blob.arrayBuffer(),
    )
    expect(new Uint8Array(await persistedSecondImage.blob.arrayBuffer())).toEqual(secondImageBytes)
    expect(persistedImages.map(({ blob }) => blob.type)).toEqual(['image/png', 'image/webp'])
    reopenedDatabase.close()
  })

  it('保存済みの作品と単独の話から検索インデックスを生成する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '読み切り作品',
      sourcePageUrl: 'https://example.com/oneshot',
    }

    await repository.series.save(fixture.series)
    await repository.episodes.save(fixture.episode)
    await repository.episodes.save(standaloneEpisode)

    const index = await repository.librarySearch.buildIndex()

    expect(index.get(fixture.series.id)).toBe(
      `${fixture.series.title} ${fixture.episode.title} ${fixture.episode.sourcePageUrl}`.toLowerCase(),
    )
    expect(index.get(standaloneEpisode.id)).toBe('読み切り作品 https://example.com/oneshot')
  })

  it('同じ元ページURLの再保存は現時点では別の話として重複登録する', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const identifiers = ['duplicate-episode-1', 'duplicate-episode-2']
    const service = createComicRegistrationService(database, {
      createId: () => identifiers.shift() ?? 'unexpected-episode-id',
    })
    const sourcePageUrl = 'https://example.com/comic/same-source'

    await service.registerStandaloneEpisode({
      registration: { title: '最初の保存', sourcePageUrl },
      images: [{ ...fixture.image, id: 'duplicate-image-1' }],
    })
    await service.registerStandaloneEpisode({
      registration: { title: '再保存', sourcePageUrl },
      images: [{ ...fixture.image, id: 'duplicate-image-2' }],
    })

    const episodesWithSameSource = (await repository.episodes.findAll()).filter(
      (episode) => episode.sourcePageUrl === sourcePageUrl,
    )
    const libraryEntries = await repository.topLevelLibrary.findAll()

    expect(episodesWithSameSource.map(({ id }) => id)).toEqual([
      'duplicate-episode-1',
      'duplicate-episode-2',
    ])
    expect(libraryEntries).toHaveLength(2)
    expect(libraryEntries.every(({ kind }) => kind === 'standaloneEpisode')).toBe(true)
  })
})
