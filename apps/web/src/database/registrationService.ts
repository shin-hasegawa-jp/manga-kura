import type { ComicImage, Episode, Series } from '@/domain/models'
import {
  type CreateSeriesRegistration,
  validateCreateSeriesRegistration,
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

export interface RegisteredSeriesWithFirstEpisode {
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
  }
}
