import type { Episode, Series } from '@/domain/models'

export type ExistingSeriesSuggestionReason = 'exact-title' | 'same-host' | 'common-path'

export interface ExistingSeriesSuggestion {
  series: Series
  score: number
  reasons: ExistingSeriesSuggestionReason[]
}

function normalizeTitle(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ja').replace(/\s+/gu, '')
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

function pathSegments(url: URL): string[] {
  const segments = url.pathname.split('/').filter(Boolean)
  return segments.slice(0, -1)
}

function commonPathSegmentCount(left: URL, right: URL): number {
  const leftSegments = pathSegments(left)
  const rightSegments = pathSegments(right)
  let count = 0

  while (
    count < leftSegments.length &&
    count < rightSegments.length &&
    leftSegments[count] === rightSegments[count]
  ) {
    count += 1
  }
  return count
}

export function rankExistingSeriesSuggestions(
  series: readonly Series[],
  episodes: readonly Episode[],
  suggestedSeriesTitle: string | undefined,
  pageUrl: string,
): ExistingSeriesSuggestion[] {
  const targetUrl = parseUrl(pageUrl)
  const normalizedSuggestedTitle = suggestedSeriesTitle
    ? normalizeTitle(suggestedSeriesTitle)
    : undefined

  return series
    .map((item): ExistingSeriesSuggestion | undefined => {
      const reasons: ExistingSeriesSuggestionReason[] = []
      let score = 0

      if (normalizedSuggestedTitle && normalizeTitle(item.title) === normalizedSuggestedTitle) {
        score += 100
        reasons.push('exact-title')
      }

      if (targetUrl) {
        const seriesUrls = episodes
          .filter((episode) => episode.seriesId === item.id)
          .map(({ sourcePageUrl }) => parseUrl(sourcePageUrl))
          .filter((url) => url !== undefined)
        const sameHostUrls = seriesUrls.filter((url) => url.host === targetUrl.host)

        if (sameHostUrls.length > 0) {
          score += 20
          reasons.push('same-host')
        }
        if (sameHostUrls.some((url) => commonPathSegmentCount(url, targetUrl) >= 2)) {
          score += 20
          reasons.push('common-path')
        }
      }

      const hasStrongEvidence =
        reasons.includes('exact-title') ||
        (reasons.includes('same-host') && reasons.includes('common-path'))
      return hasStrongEvidence ? { series: item, score, reasons } : undefined
    })
    .filter((suggestion) => suggestion !== undefined)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.series.title.localeCompare(right.series.title, 'ja') ||
        left.series.id.localeCompare(right.series.id),
    )
}
