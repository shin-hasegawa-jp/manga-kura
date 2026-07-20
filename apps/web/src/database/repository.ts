import type { Table } from 'dexie'
import type { MangaKuraDatabase } from './database'
import {
  validateAppSettings,
  validateComicImage,
  validateEpisode,
  validateSeries,
} from '@/domain/models'
import type { AppSettings, ComicImage, Episode, Series } from '@/domain/models'
import { buildLibrarySearchIndex } from './librarySearch'

export interface MangaRepository {
  series: EntityRepository<Series>
  episodes: EpisodeRepository
  images: ComicImageRepository
  settings: EntityRepository<AppSettings>
  library: LibraryRepository
  topLevelLibrary: TopLevelLibraryRepository
  seriesDetails: SeriesDetailsRepository
  librarySearch: LibrarySearchRepository
}

export interface LibrarySearchRepository {
  buildIndex(): Promise<Map<string, string>>
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
  findAllBySourcePageUrl(sourcePageUrl: string): Promise<Episode[]>
}

export interface LibraryEntry {
  episode: Episode
  series?: Series
  thumbnailImage?: ComicImage
}

export interface LibraryRepository {
  findAll(): Promise<LibraryEntry[]>
}

export type TopLevelLibraryEntry = SeriesLibraryEntry | StandaloneEpisodeLibraryEntry

export interface SeriesLibraryEntry {
  kind: 'series'
  series: Series
  episodeCount: number
  thumbnailImage?: ComicImage
}

export interface StandaloneEpisodeLibraryEntry {
  kind: 'standaloneEpisode'
  episode: Episode
  thumbnailImage?: ComicImage
}

export interface TopLevelLibraryRepository {
  findAll(): Promise<TopLevelLibraryEntry[]>
}

export interface SeriesEpisodeEntry {
  episode: Episode
  thumbnailImage?: ComicImage
}

export interface SeriesDetails {
  series: Series
  episodes: SeriesEpisodeEntry[]
}

export interface SeriesDetailsRepository {
  findBySeriesId(seriesId: string): Promise<SeriesDetails | undefined>
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
    findAllBySourcePageUrl(sourcePageUrl: string) {
      return table.where('sourcePageUrl').equals(sourcePageUrl).toArray()
    },
  }
}

function createLibraryRepository(database: MangaKuraDatabase): LibraryRepository {
  return {
    async findAll() {
      const [episodes, series, images] = await Promise.all([
        database.episodes.toArray(),
        database.series.toArray(),
        database.images.toArray(),
      ])
      const seriesById = new Map(series.map((item) => [item.id, item]))
      const firstImageByEpisodeId = new Map<string, ComicImage>()

      for (const image of images) {
        const currentFirstImage = firstImageByEpisodeId.get(image.episodeId)

        if (
          currentFirstImage === undefined ||
          image.displayOrder < currentFirstImage.displayOrder
        ) {
          firstImageByEpisodeId.set(image.episodeId, image)
        }
      }

      return episodes.map((episode) => ({
        episode,
        series: episode.seriesId ? seriesById.get(episode.seriesId) : undefined,
        thumbnailImage: firstImageByEpisodeId.get(episode.id),
      }))
    },
  }
}

function compareEpisodesForSeriesThumbnail(left: Episode, right: Episode): number {
  if (left.episodeNumber !== undefined && right.episodeNumber !== undefined) {
    const episodeNumberDifference = left.episodeNumber - right.episodeNumber

    if (episodeNumberDifference !== 0) {
      return episodeNumberDifference
    }
  } else if (left.episodeNumber !== undefined) {
    return -1
  } else if (right.episodeNumber !== undefined) {
    return 1
  }

  const createdAtDifference = left.createdAt.getTime() - right.createdAt.getTime()

  return createdAtDifference !== 0 ? createdAtDifference : left.id.localeCompare(right.id)
}

function findFirstImagesByEpisodeId(images: ComicImage[]): Map<string, ComicImage> {
  const firstImageByEpisodeId = new Map<string, ComicImage>()

  for (const image of images) {
    const currentFirstImage = firstImageByEpisodeId.get(image.episodeId)

    if (currentFirstImage === undefined || image.displayOrder < currentFirstImage.displayOrder) {
      firstImageByEpisodeId.set(image.episodeId, image)
    }
  }

  return firstImageByEpisodeId
}

function createTopLevelLibraryRepository(database: MangaKuraDatabase): TopLevelLibraryRepository {
  return {
    async findAll() {
      const [series, episodes, images] = await Promise.all([
        database.series.toArray(),
        database.episodes.toArray(),
        database.images.toArray(),
      ])
      const firstImageByEpisodeId = findFirstImagesByEpisodeId(images)
      const episodesBySeriesId = new Map<string, Episode[]>()
      const standaloneEpisodes: Episode[] = []

      for (const episode of episodes) {
        if (episode.seriesId === undefined) {
          standaloneEpisodes.push(episode)
          continue
        }

        const seriesEpisodes = episodesBySeriesId.get(episode.seriesId) ?? []
        seriesEpisodes.push(episode)
        episodesBySeriesId.set(episode.seriesId, seriesEpisodes)
      }

      const seriesEntries: SeriesLibraryEntry[] = series.map((item) => {
        const seriesEpisodes = episodesBySeriesId.get(item.id) ?? []
        const firstEpisode = [...seriesEpisodes].sort(compareEpisodesForSeriesThumbnail)[0]
        const thumbnailImage = firstEpisode ? firstImageByEpisodeId.get(firstEpisode.id) : undefined

        return {
          kind: 'series',
          series: item,
          episodeCount: seriesEpisodes.length,
          ...(thumbnailImage ? { thumbnailImage } : {}),
        }
      })
      const standaloneEntries: StandaloneEpisodeLibraryEntry[] = standaloneEpisodes.map(
        (episode) => {
          const thumbnailImage = firstImageByEpisodeId.get(episode.id)

          return {
            kind: 'standaloneEpisode',
            episode,
            ...(thumbnailImage ? { thumbnailImage } : {}),
          }
        },
      )

      return [...seriesEntries, ...standaloneEntries]
    },
  }
}

function createSeriesDetailsRepository(database: MangaKuraDatabase): SeriesDetailsRepository {
  return {
    async findBySeriesId(seriesId) {
      const series = await database.series.get(seriesId)

      if (series === undefined) {
        return undefined
      }

      const [episodes, images] = await Promise.all([
        database.episodes.where('seriesId').equals(seriesId).toArray(),
        database.images.toArray(),
      ])
      const firstImageByEpisodeId = findFirstImagesByEpisodeId(images)
      const episodeEntries = [...episodes]
        .sort(compareEpisodesForSeriesThumbnail)
        .map((episode): SeriesEpisodeEntry => {
          const thumbnailImage = firstImageByEpisodeId.get(episode.id)

          return {
            episode,
            ...(thumbnailImage ? { thumbnailImage } : {}),
          }
        })

      return { series, episodes: episodeEntries }
    },
  }
}

function createLibrarySearchRepository(database: MangaKuraDatabase): LibrarySearchRepository {
  return {
    async buildIndex() {
      const [series, episodes] = await Promise.all([
        database.series.toArray(),
        database.episodes.toArray(),
      ])

      return buildLibrarySearchIndex(series, episodes)
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
    topLevelLibrary: createTopLevelLibraryRepository(database),
    seriesDetails: createSeriesDetailsRepository(database),
    librarySearch: createLibrarySearchRepository(database),
  }
}
