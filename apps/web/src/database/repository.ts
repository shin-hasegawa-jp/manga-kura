import type { Table } from 'dexie'
import type { MangaKuraDatabase } from './database'
import {
  validateAppSettings,
  validateComicImage,
  validateEpisode,
  validateSeries,
} from '@/domain/models'
import type { AppSettings, ComicImage, Episode, Series } from '@/domain/models'

export interface EntityRepository {
  save(input: unknown): Promise<string>
}

export interface MangaRepository {
  series: EntityRepository
  episodes: EntityRepository
  images: EntityRepository
  settings: EntityRepository
}

function createEntityRepository<T extends { id: string }>(
  table: Table<T, string>,
  validate: (input: unknown) => T,
): EntityRepository {
  return {
    async save(input: unknown) {
      const entity = validate(input)
      return table.put(entity)
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
