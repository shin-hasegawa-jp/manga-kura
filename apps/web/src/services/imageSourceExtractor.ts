export interface ImageSourceExtractorDependencies {
  parseHtml(html: string): Document
}

const defaultDependencies: ImageSourceExtractorDependencies = {
  parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html')
  },
}

export type ImageSourceAttribute =
  | 'data-srcset'
  | 'srcset'
  | 'data-src'
  | 'data-original'
  | 'data-lazy-src'
  | 'data-original-src'
  | 'data-lazy'
  | 'src'

export const IMAGE_SOURCE_ATTRIBUTE_PRIORITY: readonly ImageSourceAttribute[] = [
  'data-srcset',
  'srcset',
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

type SrcsetDescriptorKind = 'width' | 'density'

interface SrcsetCandidate {
  source: string
  descriptorKind: SrcsetDescriptorKind
  descriptorValue: number
}

function parseSrcsetCandidate(value: string): SrcsetCandidate | undefined {
  const parts = value.trim().split(/\s+/)

  if (parts.length === 1 && parts[0]) {
    return { source: parts[0], descriptorKind: 'density', descriptorValue: 1 }
  }

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return undefined
  }

  const widthMatch = /^(\d+)w$/.exec(parts[1])

  if (widthMatch?.[1]) {
    const width = Number(widthMatch[1])

    return width > 0
      ? { source: parts[0], descriptorKind: 'width', descriptorValue: width }
      : undefined
  }

  const densityMatch = /^(\d+(?:\.\d+)?)x$/.exec(parts[1])

  if (densityMatch?.[1]) {
    const density = Number(densityMatch[1])

    return density > 0
      ? { source: parts[0], descriptorKind: 'density', descriptorValue: density }
      : undefined
  }

  return undefined
}

export function selectBestSourceFromSrcset(srcset: string): string | undefined {
  const candidates = srcset
    .split(',')
    .map(parseSrcsetCandidate)
    .filter((candidate) => candidate !== undefined)

  if (candidates.length === 0) {
    return undefined
  }

  const descriptorKind = candidates[0]?.descriptorKind

  if (
    descriptorKind === undefined ||
    candidates.some((candidate) => candidate.descriptorKind !== descriptorKind)
  ) {
    return undefined
  }

  let bestCandidate = candidates[0]

  for (const candidate of candidates) {
    if (bestCandidate === undefined || candidate.descriptorValue > bestCandidate.descriptorValue) {
      bestCandidate = candidate
    }
  }

  return bestCandidate?.source
}

function findImageSource(image: HTMLImageElement): ExtractedImageSource | undefined {
  for (const attribute of IMAGE_SOURCE_ATTRIBUTE_PRIORITY) {
    const attributeValue = image.getAttribute(attribute)?.trim() ?? ''

    if (attributeValue === '') {
      continue
    }

    const source =
      attribute === 'srcset' || attribute === 'data-srcset'
        ? selectBestSourceFromSrcset(attributeValue)
        : attributeValue

    if (source !== undefined) {
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
