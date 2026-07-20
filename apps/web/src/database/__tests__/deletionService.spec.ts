// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { ComicImage, Episode } from '@/domain/models'
import { DATABASE_NAME, MangaKuraDatabase } from '../database'
import { createDevelopmentComicFixture } from '../developmentComicFixture'
import { createDeletionService } from '../deletionService'
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

function image(id: string, episodeId: string): ComicImage {
  const fixture = createDevelopmentComicFixture()
  return { ...fixture.image, id, episodeId, sourceUrl: `https://example.com/${id}.png` }
}

function episode(id: string, seriesId?: string): Episode {
  const fixture = createDevelopmentComicFixture()
  return {
    ...fixture.episode,
    id,
    ...(seriesId ? { seriesId } : { seriesId: undefined }),
    sourcePageUrl: `https://example.com/${id}`,
  }
}

describe('削除サービス', () => {
  it('話を削除すると所属する画像も削除し、作品の話数を整合させる', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const service = createDeletionService(database)

    await repository.series.save({ ...fixture.series, episodeCount: 2 })
    await repository.episodes.save(episode('ep-1', fixture.series.id))
    await repository.episodes.save(episode('ep-2', fixture.series.id))
    await repository.images.save(image('img-1', 'ep-1'))
    await repository.images.save(image('img-2', 'ep-2'))

    await service.deleteEpisode('ep-1')

    expect(await repository.episodes.findById('ep-1')).toBeUndefined()
    expect(await repository.images.findByEpisodeId('ep-1')).toEqual([])
    expect(await repository.episodes.findById('ep-2')).toBeDefined()
    expect(await repository.images.findByEpisodeId('ep-2')).toHaveLength(1)
    expect((await repository.series.findById(fixture.series.id))?.episodeCount).toBe(1)
  })

  it('単独の話を削除しても作品には影響しない', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const service = createDeletionService(database)

    await repository.episodes.save(episode('standalone'))
    await repository.images.save(image('img-standalone', 'standalone'))

    await service.deleteEpisode('standalone')

    expect(await repository.episodes.findById('standalone')).toBeUndefined()
    expect(await repository.images.findByEpisodeId('standalone')).toEqual([])
  })

  it('存在しない話の削除は何もしない', async () => {
    const database = createTestDatabase()
    const service = createDeletionService(database)

    await expect(service.deleteEpisode('unknown')).resolves.toBeUndefined()
  })

  it('作品を削除すると所属する話と画像も削除し、無関係なデータは残す', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const service = createDeletionService(database)

    await repository.series.save({ ...fixture.series, episodeCount: 2 })
    await repository.episodes.save(episode('ep-1', fixture.series.id))
    await repository.episodes.save(episode('ep-2', fixture.series.id))
    await repository.images.save(image('img-1', 'ep-1'))
    await repository.images.save(image('img-2', 'ep-2'))
    await repository.episodes.save(episode('standalone'))
    await repository.images.save(image('img-standalone', 'standalone'))

    await service.deleteSeries(fixture.series.id)

    expect(await repository.series.findById(fixture.series.id)).toBeUndefined()
    expect(await database.episodes.count()).toBe(1)
    expect(await database.images.count()).toBe(1)
    expect(await repository.episodes.findById('standalone')).toBeDefined()
  })

  it('存在しない作品の削除は何もしない', async () => {
    const database = createTestDatabase()
    const service = createDeletionService(database)

    await expect(service.deleteSeries('unknown')).resolves.toBeUndefined()
  })

  it('画像単位で削除でき、話や他の画像は残す', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const service = createDeletionService(database)

    await repository.episodes.save(episode('ep-1'))
    await repository.images.save(image('img-1', 'ep-1'))
    await repository.images.save(image('img-2', 'ep-1'))

    await service.deleteImage('img-1')

    expect(await repository.images.findById('img-1')).toBeUndefined()
    expect(await repository.images.findById('img-2')).toBeDefined()
    expect(await repository.episodes.findById('ep-1')).toBeDefined()
  })

  it('全データ削除で作品・話・画像を消し、設定は残す', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()
    const service = createDeletionService(database)

    await repository.series.save(fixture.series)
    await repository.episodes.save(episode('ep-1', fixture.series.id))
    await repository.images.save(image('img-1', 'ep-1'))
    await repository.settings.save({
      id: 'app',
      sortOrder: 'recentlyRead',
      displaySettings: { theme: 'system' },
      schemaVersion: 1,
      offlineSettings: { enabled: false },
      storageSettings: { warningThresholdBytes: 0 },
    })

    await service.deleteAllData()

    expect(await database.series.count()).toBe(0)
    expect(await database.episodes.count()).toBe(0)
    expect(await database.images.count()).toBe(0)
    expect(await repository.settings.findById('app')).toBeDefined()
  })
})
