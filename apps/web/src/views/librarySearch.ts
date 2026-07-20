import { normalizeSearchText } from '@/database/librarySearch'
import type { TopLevelLibraryEntry } from '@/database/repository'

/**
 * 検索語でトップ一覧の項目を絞り込む。空語の場合は全件を返す。
 * 判定は事前に生成した検索インデックス（正規化済みテキスト）に対して行う。
 */
export function filterLibraryEntries(
  entries: readonly TopLevelLibraryEntry[],
  query: string,
  searchIndex: ReadonlyMap<string, string>,
): TopLevelLibraryEntry[] {
  const normalized = normalizeSearchText(query)
  if (normalized === '') return [...entries]

  return entries.filter((entry) => {
    const itemId = entry.kind === 'series' ? entry.series.id : entry.episode.id
    return (searchIndex.get(itemId) ?? '').includes(normalized)
  })
}
