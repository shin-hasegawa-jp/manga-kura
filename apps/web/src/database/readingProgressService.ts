import type { Episode, Series } from '@/domain/models'
import type { MangaKuraDatabase } from './database'
import { createMangaRepository } from './repository'

export interface ReadingPositionInput {
  episodeId: string
  scrollPosition: number
  scrollProgress: number
  savedContentHeight: number
}

export interface RecordedReadingPosition {
  episode: Episode
  series?: Series
}

export interface ReadingProgressServiceDependencies {
  now?: () => Date
}

export interface ReadingProgressService {
  recordPosition(input: ReadingPositionInput): Promise<RecordedReadingPosition | undefined>
}

function getMaxLastReadAt(episodes: readonly Episode[]): Date | undefined {
  let latest: number | undefined

  for (const episode of episodes) {
    if (episode.lastReadAt === undefined) continue

    const time = episode.lastReadAt.getTime()
    if (latest === undefined || time > latest) {
      latest = time
    }
  }

  return latest === undefined ? undefined : new Date(latest)
}

export function createReadingProgressService(
  database: MangaKuraDatabase,
  dependencies: ReadingProgressServiceDependencies = {},
): ReadingProgressService {
  const repository = createMangaRepository(database)
  const now = dependencies.now ?? (() => new Date())

  return {
    async recordPosition(input) {
      return database.transaction('rw', database.episodes, database.series, async () => {
        const existingEpisode = await repository.episodes.findById(input.episodeId)

        // 閲覧中に話が削除された場合は、周期保存を静かに無視する
        if (existingEpisode === undefined) {
          return undefined
        }

        const readAt = now()
        const episode: Episode = {
          ...existingEpisode,
          scrollPosition: input.scrollPosition,
          scrollProgress: input.scrollProgress,
          savedContentHeight: input.savedContentHeight,
          lastReadAt: readAt,
        }
        await repository.episodes.save(episode)

        if (episode.seriesId === undefined) {
          return { episode }
        }

        const existingSeries = await repository.series.findById(episode.seriesId)
        if (existingSeries === undefined) {
          return { episode }
        }

        // 作品の最終閲覧日時は、所属する話の最終閲覧日時の最大値とする
        const seriesEpisodes = await database.episodes
          .where('seriesId')
          .equals(episode.seriesId)
          .toArray()
        const lastReadAt = getMaxLastReadAt(seriesEpisodes)
        const series: Series = {
          ...existingSeries,
          ...(lastReadAt ? { lastReadAt } : {}),
        }
        await repository.series.save(series)

        return { episode, series }
      })
    },
  }
}
