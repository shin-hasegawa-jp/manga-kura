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
  episodes: EpisodeRepository
  images: ComicImageRepository
  settings: EntityRepository
  library: LibraryRepository
}

export interface EntityRepository<T extends { id: string } = { id: string }> {
  save(input: unknown): Promise<string>
  findById(id: string): Promise<T | undefined>
  findAll(): Promise<T[]>
}

export interface ComicImageRepository extends EntityRepository<ComicImage> {
  findByEpisodeId(episodeId: string): Promise<ComicImage[]>
}

export interface EpisodeRepository extends EntityRepository<Episode> {
  findBySourcePageUrl(sourcePageUrl: string): Promise<Episode | undefined>
}

export interface LibraryEntry {
  episode: Episode
  series?: Series
}

export interface LibraryRepository {
  findAll(): Promise<LibraryEntry[]>
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

function createEpisodeRepository(table: Table<Episode, string>): EpisodeRepository {
  const repository = createEntityRepository(table, validateEpisode)

  return {
    ...repository,
    findBySourcePageUrl(sourcePageUrl: string) {
      return table.where('sourcePageUrl').equals(sourcePageUrl).first()
    },
  }
}

function createLibraryRepository(database: MangaKuraDatabase): LibraryRepository {
  return {
    async findAll() {
      const [episodes, series] = await Promise.all([
        database.episodes.toArray(),
        database.series.toArray(),
      ])
      const seriesById = new Map(series.map((item) => [item.id, item]))

      return episodes.map((episode) => ({
        episode,
        series: episode.seriesId ? seriesById.get(episode.seriesId) : undefined,
      }))
    },
  }
}

export function createMangaRepository(database: MangaKuraDatabase): MangaRepository {
  return {
    series: createEntityRepository<Series>(database.series, validateSeries),
    episodes: createEpisodeRepository(database.episodes),
    images: createComicImageRepository(database.images),
    settings: createEntityRepository<AppSettings>(database.settings, validateAppSettings),
    library: createLibraryRepository(database),
  }
}
