import type { LibraryEntry } from '@/database/repository'

export interface LibraryEntryText {
  episodeId: string
  episodeTitle: string
  contextLabel: string
  kind: 'series' | 'standalone'
}

export function getLibraryEntryText(entry: LibraryEntry): LibraryEntryText {
  if (entry.series === undefined) {
    return {
      episodeId: entry.episode.id,
      episodeTitle: entry.episode.title,
      contextLabel: '単独の話',
      kind: 'standalone',
    }
  }

  return {
    episodeId: entry.episode.id,
    episodeTitle: entry.episode.title,
    contextLabel: entry.series.title,
    kind: 'series',
  }
}
