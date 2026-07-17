// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DATABASE_NAME, DATABASE_VERSION, MangaKuraDatabase } from '../database'
import { createDevelopmentComicFixture } from '../developmentComicFixture'
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
  it('uses the configured name and schema version', () => {
    const database = new MangaKuraDatabase()

    expect(database.name).toBe(DATABASE_NAME)
    expect(database.verno).toBe(DATABASE_VERSION)

    database.close()
  })

  it('defines the required stores, primary keys, and indexes', async () => {
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

  it('does not save data that fails runtime validation', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)

    await expect(repository.series.save({ id: 'invalid-series' })).rejects.toThrow()
    expect(await database.series.count()).toBe(0)
  })

  it('saves and reads the development series and episode fixture without duplication', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)
    const fixture = createDevelopmentComicFixture()

    await repository.series.save(fixture.series)
    await repository.episodes.save(fixture.episode)

    expect(await repository.series.findById(fixture.series.id)).toEqual(fixture.series)
    expect(await repository.episodes.findById(fixture.episode.id)).toEqual(fixture.episode)

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

  it('saves and reads development image blobs in display order', async () => {
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
