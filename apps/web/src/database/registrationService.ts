import type { ComicImage, Episode, Series } from '@/domain/models'
import {
  type AddEpisodeToSeriesRegistration,
  type CreateSeriesRegistration,
  type CreateStandaloneEpisodeRegistration,
  validateAddEpisodeToSeriesRegistration,
  validateCreateSeriesRegistration,
  validateCreateStandaloneEpisodeRegistration,
} from '@/domain/registration'
import type { MangaKuraDatabase } from './database'
import { createMangaRepository } from './repository'

export type RegistrationImage = Pick<
  ComicImage,
  'id' | 'displayOrder' | 'blob' | 'sourceUrl' | 'mimeType' | 'fileSize' | 'width' | 'height'
>

export interface RegisterSeriesWithFirstEpisodeInput {
  registration: CreateSeriesRegistration
  image: RegistrationImage
}

export interface RegisterStandaloneEpisodeInput {
  registration: CreateStandaloneEpisodeRegistration
  image: RegistrationImage
}

export interface AddEpisodeToSeriesInput {
  registration: AddEpisodeToSeriesRegistration
  image: RegistrationImage
}

export interface RegisteredSeriesWithFirstEpisode {
  series: Series
  episode: Episode
  image: ComicImage
}

export interface RegisteredStandaloneEpisode {
  episode: Episode
  image: ComicImage
}

export interface AddedEpisodeToSeries {
  series: Series
  episode: Episode
  image: ComicImage
}

export interface RegistrationServiceDependencies {
  createId?: () => string
  now?: () => Date
}

export interface ComicRegistrationService {
  registerSeriesWithFirstEpisode(
    input: RegisterSeriesWithFirstEpisodeInput,
  ): Promise<RegisteredSeriesWithFirstEpisode>
  registerStandaloneEpisode(
    input: RegisterStandaloneEpisodeInput,
  ): Promise<RegisteredStandaloneEpisode>
  addEpisodeToSeries(input: AddEpisodeToSeriesInput): Promise<AddedEpisodeToSeries>
}

export function createComicRegistrationService(
  database: MangaKuraDatabase,
  dependencies: RegistrationServiceDependencies = {},
): ComicRegistrationService {
  const repository = createMangaRepository(database)
  const createId = dependencies.createId ?? crypto.randomUUID
  const now = dependencies.now ?? (() => new Date())

  return {
    async registerSeriesWithFirstEpisode(input) {
      const registration = validateCreateSeriesRegistration(input.registration)
      const registeredAt = now()
      const series: Series = {
        id: createId(),
        title: registration.seriesTitle,
        createdAt: registeredAt,
        updatedAt: registeredAt,
        episodeCount: 1,
      }
      const episode: Episode = {
        id: createId(),
        seriesId: series.id,
        title: registration.title,
        sourcePageUrl: registration.sourcePageUrl,
        createdAt: registeredAt,
        updatedAt: registeredAt,
        scrollPosition: 0,
        scrollProgress: 0,
      }
      const image: ComicImage = {
        ...input.image,
        episodeId: episode.id,
        createdAt: registeredAt,
      }

      await database.transaction(
        'rw',
        database.series,
        database.episodes,
        database.images,
        async () => {
          await repository.series.save(series)
          await repository.episodes.save(episode)
          await repository.images.save(image)
        },
      )

      return { series, episode, image }
    },
    async registerStandaloneEpisode(input) {
      const registration = validateCreateStandaloneEpisodeRegistration(input.registration)
      const registeredAt = now()
      const episode: Episode = {
        id: createId(),
        title: registration.title,
        sourcePageUrl: registration.sourcePageUrl,
        createdAt: registeredAt,
        updatedAt: registeredAt,
        scrollPosition: 0,
        scrollProgress: 0,
      }
      const image: ComicImage = {
        ...input.image,
        episodeId: episode.id,
        createdAt: registeredAt,
      }

      await database.transaction('rw', database.episodes, database.images, async () => {
        await repository.episodes.save(episode)
        await repository.images.save(image)
      })

      return { episode, image }
    },
    async addEpisodeToSeries(input) {
      const registration = validateAddEpisodeToSeriesRegistration(input.registration)

      return database.transaction(
        'rw',
        database.series,
        database.episodes,
        database.images,
        async () => {
          const existingSeries = await repository.series.findById(registration.seriesId)

          if (existingSeries === undefined) {
            throw new Error('追加先の作品が見つかりません')
          }

          const registeredAt = now()
          const series: Series = {
            ...existingSeries,
            episodeCount: existingSeries.episodeCount + 1,
            updatedAt: registeredAt,
          }
          const episode: Episode = {
            id: createId(),
            seriesId: series.id,
            title: registration.title,
            sourcePageUrl: registration.sourcePageUrl,
            createdAt: registeredAt,
            updatedAt: registeredAt,
            scrollPosition: 0,
            scrollProgress: 0,
          }
          const image: ComicImage = {
            ...input.image,
            episodeId: episode.id,
            createdAt: registeredAt,
          }

          await repository.series.save(series)
          await repository.episodes.save(episode)
          await repository.images.save(image)

          return { series, episode, image }
        },
      )
    },
  }
}
