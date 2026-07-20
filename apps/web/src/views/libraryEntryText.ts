import type { TopLevelLibraryEntry } from '@/database/repository'
import { getReadingProgressText, type ReadingProgressText } from './readingProgress'

export interface LibraryEntryText {
  itemId: string
  title: string
  kind: 'series' | 'standaloneEpisode'
  kindLabel: string
  detailLabel?: string
  readingProgress?: ReadingProgressText
}

export function getLibraryEntryText(entry: TopLevelLibraryEntry): LibraryEntryText {
  if (entry.kind === 'standaloneEpisode') {
    const readingProgress = getReadingProgressText(entry.episode)

    return {
      itemId: entry.episode.id,
      title: entry.episode.title,
      kind: entry.kind,
      kindLabel: '単独の話',
      ...(entry.episode.episodeNumber !== undefined
        ? { detailLabel: `第${entry.episode.episodeNumber}話` }
        : {}),
      ...(readingProgress.status !== 'unread' ? { readingProgress } : {}),
    }
  }

  return {
    itemId: entry.series.id,
    title: entry.series.title,
    kind: entry.kind,
    kindLabel: '作品',
    detailLabel: `全${entry.episodeCount}話`,
  }
}
