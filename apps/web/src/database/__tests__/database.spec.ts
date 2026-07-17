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
})
