import type { Table } from 'dexie'
import type { MangaKuraDatabase } from './database'
import {
  validateAppSettings,
  validateComicImage,
  validateEpisode,
  validateSeries,
} from '@/domain/models'
import type { AppSettings, ComicImage, Episode, Series } from '@/domain/models'

export interface MangaRepository {
  series: EntityRepository<Series>
  episodes: EntityRepository<Episode>
  images: ComicImageRepository
  settings: EntityRepository
}

export interface EntityRepository<T extends { id: string } = { id: string }> {
  save(input: unknown): Promise<string>
  findById(id: string): Promise<T | undefined>
  findAll(): Promise<T[]>
}

export interface ComicImageRepository extends EntityRepository<ComicImage> {
  findByEpisodeId(episodeId: string): Promise<ComicImage[]>
}

function createEntityRepository<T extends { id: string }>(
  table: Table<T, string>,
  validate: (input: unknown) => T,
): EntityRepository<T> {
  return {
    async save(input: unknown) {
      const entity = validate(input)
      return table.put(entity)
    },
    findById(id: string) {
      return table.get(id)
    },
    findAll() {
      return table.toArray()
    },
  }
}

function createComicImageRepository(table: Table<ComicImage, string>): ComicImageRepository {
  const repository = createEntityRepository(table, validateComicImage)

  return {
    ...repository,
    async findByEpisodeId(episodeId: string) {
      return table.where('episodeId').equals(episodeId).sortBy('displayOrder')
    },
  }
}

export function createMangaRepository(database: MangaKuraDatabase): MangaRepository {
  return {
    series: createEntityRepository<Series>(database.series, validateSeries),
    episodes: createEntityRepository<Episode>(database.episodes, validateEpisode),
    images: createComicImageRepository(database.images),
    settings: createEntityRepository<AppSettings>(database.settings, validateAppSettings),
  }
}
