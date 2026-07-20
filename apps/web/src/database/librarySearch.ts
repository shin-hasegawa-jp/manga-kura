import type { Episode, Series } from '@/domain/models'

/**
 * 検索用にテキストを正規化する（前後空白の除去と小文字化）。
 */
export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * トップ一覧の項目IDごとに、検索対象テキスト（正規化済み）を作る。
 * - 作品：作品タイトル＋所属する話のタイトル・掲載元ページURL
 * - 単独の話：話タイトル＋掲載元ページURL
 * 検索はブラウザ内のローカルデータのみを対象とする。
 */
export function buildLibrarySearchIndex(
  seriesList: readonly Series[],
  episodes: readonly Episode[],
): Map<string, string> {
  const episodesBySeriesId = new Map<string, Episode[]>()
  const index = new Map<string, string>()

  for (const episode of episodes) {
    if (episode.seriesId === undefined) {
      index.set(episode.id, normalizeSearchText(`${episode.title} ${episode.sourcePageUrl}`))
      continue
    }

    const group = episodesBySeriesId.get(episode.seriesId) ?? []
    group.push(episode)
    episodesBySeriesId.set(episode.seriesId, group)
  }

  for (const series of seriesList) {
    const members = episodesBySeriesId.get(series.id) ?? []
    const parts = [
      series.title,
      ...members.flatMap((episode) => [episode.title, episode.sourcePageUrl]),
    ]
    index.set(series.id, normalizeSearchText(parts.join(' ')))
  }

  return index
}
