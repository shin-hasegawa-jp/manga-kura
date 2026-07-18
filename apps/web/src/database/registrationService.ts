import { v4 as uuidv4 } from 'uuid'
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

export type RegistrationImageSource = Pick<
  ComicImage,
  'blob' | 'sourceUrl' | 'mimeType' | 'fileSize' | 'width' | 'height'
>

export interface RegisterSeriesWithFirstEpisodeInput {
  registration: CreateSeriesRegistration
  images: readonly RegistrationImage[]
}

export interface RegisterStandaloneEpisodeInput {
  registration: CreateStandaloneEpisodeRegistration
  images: readonly RegistrationImage[]
}

export interface AddEpisodeToSeriesInput {
  registration: AddEpisodeToSeriesRegistration
  images: readonly RegistrationImage[]
}

export interface RegisteredSeriesWithFirstEpisode {
  series: Series
  episode: Episode
  images: ComicImage[]
}

export interface RegisteredStandaloneEpisode {
  episode: Episode
  images: ComicImage[]
}

export interface AddedEpisodeToSeries {
  series: Series
  episode: Episode
  images: ComicImage[]
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

export function createRegistrationId(): string {
  return globalThis.crypto?.randomUUID() ?? uuidv4()
}

export function createRegistrationImages(
  imageSources: readonly RegistrationImageSource[],
  createId: () => string = createRegistrationId,
): RegistrationImage[] {
  return imageSources.map((image, displayOrder) => ({
    ...image,
    id: createId(),
    displayOrder,
  }))
}

function createComicImages(
  images: readonly RegistrationImage[],
  episodeId: string,
  createdAt: Date,
): ComicImage[] {
  if (images.length === 0) {
    throw new Error('保存する画像が選択されていません')
  }

  return images.map((image, displayOrder) => ({
    ...image,
    displayOrder,
    episodeId,
    createdAt,
  }))
}

export function createComicRegistrationService(
  database: MangaKuraDatabase,
  dependencies: RegistrationServiceDependencies = {},
): ComicRegistrationService {
  const repository = createMangaRepository(database)
  const createId = dependencies.createId ?? createRegistrationId
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
      const images = createComicImages(input.images, episode.id, registeredAt)

      await database.transaction(
        'rw',
        database.series,
        database.episodes,
        database.images,
        async () => {
          await repository.series.save(series)
          await repository.episodes.save(episode)
          for (const image of images) {
            await repository.images.save(image)
          }
        },
      )

      return { series, episode, images }
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
      const images = createComicImages(input.images, episode.id, registeredAt)

      await database.transaction('rw', database.episodes, database.images, async () => {
        await repository.episodes.save(episode)
        for (const image of images) {
          await repository.images.save(image)
        }
      })

      return { episode, images }
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
          const images = createComicImages(input.images, episode.id, registeredAt)

          await repository.series.save(series)
          await repository.episodes.save(episode)
          for (const image of images) {
            await repository.images.save(image)
          }

          return { series, episode, images }
        },
      )
    },
  }
}
