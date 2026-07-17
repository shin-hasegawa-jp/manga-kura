import type { SeriesEpisodeEntry } from '@/database/repository'
import type { ObjectUrlRegistry } from '@/utils/objectUrlRegistry'

export interface SeriesEpisodeListItem {
  episodeId: string
  title: string
  episodeNumberLabel?: string
  thumbnailUrl?: string
}

export interface SeriesEpisodeListItemPresenter {
  present(entries: readonly SeriesEpisodeEntry[]): SeriesEpisodeListItem[]
  dispose(): void
}

export function createSeriesEpisodeListItemPresenter(
  objectUrls: ObjectUrlRegistry,
): SeriesEpisodeListItemPresenter {
  return {
    present(entries) {
      objectUrls.revokeAll()

      return entries.map(({ episode, thumbnailImage }) => ({
        episodeId: episode.id,
        title: episode.title,
        ...(episode.episodeNumber !== undefined
          ? { episodeNumberLabel: `第${episode.episodeNumber}話` }
          : {}),
        ...(thumbnailImage ? { thumbnailUrl: objectUrls.create(thumbnailImage.blob) } : {}),
      }))
    },
    dispose() {
      objectUrls.revokeAll()
    },
  }
}
