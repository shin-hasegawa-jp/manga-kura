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
  images: EntityRepository
  settings: EntityRepository
}

export interface EntityRepository<T extends { id: string } = { id: string }> {
  save(input: unknown): Promise<string>
  findById(id: string): Promise<T | undefined>
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
  }
}

export function createMangaRepository(database: MangaKuraDatabase): MangaRepository {
  return {
    series: createEntityRepository<Series>(database.series, validateSeries),
    episodes: createEntityRepository<Episode>(database.episodes, validateEpisode),
    images: createEntityRepository<ComicImage>(database.images, validateComicImage),
    settings: createEntityRepository<AppSettings>(database.settings, validateAppSettings),
  }
}
