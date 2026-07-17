import type { TopLevelLibraryEntry } from '@/database/repository'
import type { ObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import { getLibraryEntryText, type LibraryEntryText } from './libraryEntryText'

export interface LibraryListItem extends LibraryEntryText {
  thumbnailUrl?: string
}

export interface LibraryListItemPresenter {
  present(entries: readonly TopLevelLibraryEntry[]): LibraryListItem[]
  dispose(): void
}

export function createLibraryListItemPresenter(
  objectUrls: ObjectUrlRegistry,
): LibraryListItemPresenter {
  return {
    present(entries) {
      objectUrls.revokeAll()

      return entries.map((entry) => ({
        ...getLibraryEntryText(entry),
        thumbnailUrl: entry.thumbnailImage
          ? objectUrls.create(entry.thumbnailImage.blob)
          : undefined,
      }))
    },
    dispose() {
      objectUrls.revokeAll()
    },
  }
}
