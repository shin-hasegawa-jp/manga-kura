// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DATABASE_NAME, MangaKuraDatabase } from '../database'
import { createDevelopmentComicFixture } from '../developmentComicFixture'
import { createReadingProgressService } from '../readingProgressService'
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

describe('閲覧位置の記録', () => {
  it('単独の話の閲覧位置と最終閲覧日時を保存し、更新日時は変えない', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '単独の話',
    }
    const readAt = new Date('2026-07-20T05:00:00.000Z')
    const service = createReadingProgressService(database, { now: () => readAt })

    await repository.episodes.save(standaloneEpisode)

    const recorded = await service.recordPosition({
      episodeId: standaloneEpisode.id,
      scrollPosition: 1200,
      scrollProgress: 0.5,
      savedContentHeight: 2400,
    })

    expect(recorded).toEqual({
      episode: {
        ...standaloneEpisode,
        scrollPosition: 1200,
        scrollProgress: 0.5,
        savedContentHeight: 2400,
        lastReadAt: readAt,
      },
    })
    expect(await repository.episodes.findById(standaloneEpisode.id)).toEqual(recorded?.episode)
    expect(recorded?.episode.updatedAt).toEqual(standaloneEpisode.updatedAt)
  })

  it('作品の最終閲覧日時を所属する話の最終閲覧日時の最大値にする', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const firstEpisode = fixture.episode
    const secondEpisode = {
      ...fixture.episode,
      id: 'development-episode-2',
      title: '第2話',
      episodeNumber: 2,
      sourcePageUrl: 'https://example.com/development-series/episodes/2',
    }

    await repository.series.save(fixture.series)
    await repository.episodes.save(firstEpisode)
    await repository.episodes.save(secondEpisode)

    const earlier = new Date('2026-07-20T05:00:00.000Z')
    const later = new Date('2026-07-20T06:00:00.000Z')
    const latest = new Date('2026-07-20T07:00:00.000Z')

    await createReadingProgressService(database, { now: () => earlier }).recordPosition({
      episodeId: firstEpisode.id,
      scrollPosition: 100,
      scrollProgress: 0.1,
      savedContentHeight: 1000,
    })
    const afterSecond = await createReadingProgressService(database, {
      now: () => later,
    }).recordPosition({
      episodeId: secondEpisode.id,
      scrollPosition: 200,
      scrollProgress: 0.2,
      savedContentHeight: 1000,
    })

    expect(afterSecond?.series?.lastReadAt).toEqual(later)
    expect((await repository.series.findById(fixture.series.id))?.lastReadAt).toEqual(later)

    // 先に読んだ話を再度読むと、作品の最終閲覧日時が最新へ更新される
    const afterFirstAgain = await createReadingProgressService(database, {
      now: () => latest,
    }).recordPosition({
      episodeId: firstEpisode.id,
      scrollPosition: 300,
      scrollProgress: 0.3,
      savedContentHeight: 1000,
    })

    expect(afterFirstAgain?.series?.lastReadAt).toEqual(latest)
    expect((await repository.series.findById(fixture.series.id))?.lastReadAt).toEqual(latest)
  })

  it('対象の話が存在しない場合は何も保存しない', async () => {
    const database = createTestDatabase()

    const recorded = await createReadingProgressService(database).recordPosition({
      episodeId: 'unknown-episode',
      scrollPosition: 100,
      scrollProgress: 0.1,
      savedContentHeight: 1000,
    })

    expect(recorded).toBeUndefined()
    expect(await database.episodes.count()).toBe(0)
  })
})
