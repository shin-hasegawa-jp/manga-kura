export interface SaveMetadataSuggestions {
  pageTitle?: string
  seriesTitle?: string
  episodeTitle?: string
  episodeNumber?: number
}

const JAPANESE_EPISODE_PATTERN = /第?\s*(\d{1,6})\s*話/giu
const ENGLISH_EPISODE_PATTERN = /(?:episode|ep)[\s._-]*(\d{1,6})(?!\d)/giu
const TITLE_SEPARATOR_PATTERN = /\s+[|｜–—-]\s+/

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

function collectEpisodeNumbers(value: string): number[] {
  const numbers = new Set<number>()

  for (const pattern of [JAPANESE_EPISODE_PATTERN, ENGLISH_EPISODE_PATTERN]) {
    pattern.lastIndex = 0
    for (const match of value.matchAll(pattern)) {
      const rawNumber = match[1]
      if (rawNumber !== undefined) {
        numbers.add(Number(rawNumber))
      }
    }
  }
  return [...numbers]
}

function inferEpisodeNumber(pageTitle: string | undefined, pageUrl: string): number | undefined {
  const titleNumbers = pageTitle ? collectEpisodeNumbers(pageTitle) : []
  if (titleNumbers.length === 1) {
    return titleNumbers[0]
  }
  if (titleNumbers.length > 1) {
    return undefined
  }

  let path: string
  try {
    path = decodeURIComponent(new URL(pageUrl).pathname)
  } catch {
    return undefined
  }
  const pathNumbers = collectEpisodeNumbers(path)
  return pathNumbers.length === 1 ? pathNumbers[0] : undefined
}

function removeEpisodeMarker(value: string): string {
  const withoutJapaneseMarker = value.replace(JAPANESE_EPISODE_PATTERN, ' ')
  const withoutEnglishMarker = withoutJapaneseMarker.replace(ENGLISH_EPISODE_PATTERN, ' ')
  return normalizeText(withoutEnglishMarker.replace(/[-–—|｜:：]+$/u, ''))
}

export function createSaveMetadataSuggestions(
  pageTitle: string | undefined,
  pageUrl: string,
): SaveMetadataSuggestions {
  const normalizedPageTitle = pageTitle ? normalizeText(pageTitle) : ''
  const primaryTitle = normalizedPageTitle.split(TITLE_SEPARATOR_PATTERN)[0] ?? ''
  const seriesTitle = removeEpisodeMarker(primaryTitle)
  const episodeNumber = inferEpisodeNumber(normalizedPageTitle || undefined, pageUrl)

  return {
    ...(normalizedPageTitle ? { pageTitle: normalizedPageTitle } : {}),
    ...(seriesTitle ? { seriesTitle } : {}),
    ...(primaryTitle ? { episodeTitle: primaryTitle } : {}),
    ...(episodeNumber !== undefined ? { episodeNumber } : {}),
  }
}
