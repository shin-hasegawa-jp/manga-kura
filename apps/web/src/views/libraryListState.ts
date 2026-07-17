import type { TopLevelLibraryEntry } from '@/database/repository'

export type LibraryListState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'populated'; entries: readonly TopLevelLibraryEntry[] }

export function getLibraryListState(
  entries: readonly TopLevelLibraryEntry[] | undefined,
): LibraryListState {
  if (entries === undefined) {
    return { kind: 'loading' }
  }

  if (entries.length === 0) {
    return { kind: 'empty' }
  }

  return { kind: 'populated', entries }
}
