import { type LibrarySortOrder, type Series } from '@/domain/models'
import type { TopLevelLibraryEntry } from '@/database/repository'

export {
  DEFAULT_LIBRARY_SORT_ORDER,
  LIBRARY_SORT_ORDERS,
  type LibrarySortOrder,
} from '@/domain/models'

interface SortableEntry {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  lastReadAt?: Date
}

function toSortable(entry: TopLevelLibraryEntry): SortableEntry {
  // 作品は自身の最終閲覧日時（＝所属話の最終閲覧日時の最大値）を用いる
  const source: Pick<Series, 'id' | 'title' | 'createdAt' | 'updatedAt' | 'lastReadAt'> =
    entry.kind === 'series' ? entry.series : entry.episode

  return {
    id: source.id,
    title: source.title,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    ...(source.lastReadAt ? { lastReadAt: source.lastReadAt } : {}),
  }
}

// 最近読んだ順の並び替えキー。未閲覧の項目は追加日時を用いる。
function getReadSortKey(entry: SortableEntry): number {
  return (entry.lastReadAt ?? entry.createdAt).getTime()
}

function comparePrimary(
  left: SortableEntry,
  right: SortableEntry,
  order: LibrarySortOrder,
): number {
  switch (order) {
    case 'recentlyRead':
      return getReadSortKey(right) - getReadSortKey(left)
    case 'recentlyAdded':
      return right.createdAt.getTime() - left.createdAt.getTime()
    case 'recentlyUpdated':
      return right.updatedAt.getTime() - left.updatedAt.getTime()
    case 'title':
      return left.title.localeCompare(right.title, 'ja')
  }
}

/**
 * トップ一覧の項目を指定した並び順で並べ替える。入力は変更せず新しい配列を返す。
 * 同値の場合はタイトル・IDで安定した順序に落とす。
 */
export function sortLibraryEntries(
  entries: readonly TopLevelLibraryEntry[],
  order: LibrarySortOrder,
): TopLevelLibraryEntry[] {
  return entries
    .map((entry) => ({ entry, sortable: toSortable(entry) }))
    .sort((left, right) => {
      const primary = comparePrimary(left.sortable, right.sortable, order)
      if (primary !== 0) return primary

      const byTitle = left.sortable.title.localeCompare(right.sortable.title, 'ja')
      if (byTitle !== 0) return byTitle

      return left.sortable.id.localeCompare(right.sortable.id)
    })
    .map(({ entry }) => entry)
}
