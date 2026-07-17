import type { TopLevelLibraryEntry } from '@/database/repository'

export interface LibraryEntryText {
  itemId: string
  title: string
  kind: 'series' | 'standaloneEpisode'
  kindLabel: string
  detailLabel?: string
}

export function getLibraryEntryText(entry: TopLevelLibraryEntry): LibraryEntryText {
  if (entry.kind === 'standaloneEpisode') {
    return {
      itemId: entry.episode.id,
      title: entry.episode.title,
      kind: entry.kind,
      kindLabel: '単独の話',
      ...(entry.episode.episodeNumber !== undefined
        ? { detailLabel: `第${entry.episode.episodeNumber}話` }
        : {}),
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
