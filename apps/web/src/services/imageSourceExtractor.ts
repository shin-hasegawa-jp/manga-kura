export interface ImageSourceExtractorDependencies {
  parseHtml(html: string): Document
}

const defaultDependencies: ImageSourceExtractorDependencies = {
  parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html')
  },
}

export type ImageSourceAttribute =
  | 'data-src'
  | 'data-original'
  | 'data-lazy-src'
  | 'data-original-src'
  | 'data-lazy'
  | 'src'

export const IMAGE_SOURCE_ATTRIBUTE_PRIORITY: readonly ImageSourceAttribute[] = [
  'data-src',
  'data-original',
  'data-lazy-src',
  'data-original-src',
  'data-lazy',
  'src',
]

export interface ExtractedImageSource {
  source: string
  attribute: ImageSourceAttribute
}

function findImageSource(image: HTMLImageElement): ExtractedImageSource | undefined {
  for (const attribute of IMAGE_SOURCE_ATTRIBUTE_PRIORITY) {
    const source = image.getAttribute(attribute)?.trim() ?? ''

    if (source !== '') {
      return { source, attribute }
    }
  }

  return undefined
}

export function extractImageSourceCandidates(
  html: string,
  dependencies: ImageSourceExtractorDependencies = defaultDependencies,
): ExtractedImageSource[] {
  const document = dependencies.parseHtml(html)
  const candidates: ExtractedImageSource[] = []
  const seenSources = new Set<string>()

  for (const image of document.querySelectorAll('img')) {
    const candidate = findImageSource(image)

    if (candidate === undefined || seenSources.has(candidate.source)) {
      continue
    }

    seenSources.add(candidate.source)
    candidates.push(candidate)
  }

  return candidates
}

export function extractImageSources(
  html: string,
  dependencies: ImageSourceExtractorDependencies = defaultDependencies,
): string[] {
  return extractImageSourceCandidates(html, dependencies).map(({ source }) => source)
}
