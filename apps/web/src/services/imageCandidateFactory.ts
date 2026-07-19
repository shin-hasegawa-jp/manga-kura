import {
  resolveImageSourceCandidates,
  type ImageSourceAttribute,
  type ImageSourceExtractorDependencies,
} from './imageSourceExtractor'
import type { ApiImageCandidate } from './acquisitionApiSchemas'

export type ImageCandidateFetchStatus = 'idle' | 'loading' | 'loaded' | 'failed'

export type ImageCandidateSelectionReason =
  | 'sequential-filename'
  | 'continuous-dom-order'
  | 'common-url-path'
  | 'large-image'
  | 'portrait-aspect-ratio'
  | 'small-image'
  | 'extremely-wide-image'
  | 'decorative-filename'
  | 'image-load-failed'

interface ImageCandidateBase {
  id: string
  domOrder: number
  imageUrl: string
  sourceAttribute: ImageSourceAttribute
  isSelected: boolean
  score: number
  selectionReasons: ImageCandidateSelectionReason[]
  fetchStatus: ImageCandidateFetchStatus
  width?: number
  height?: number
}

export type ImageCandidate = ImageCandidateBase &
  (
    | { acquisitionMethod: 'direct' }
    | { acquisitionMethod: 'api'; proxyToken: string; previewToken: string }
  )

export function createImageCandidates(
  html: string,
  pageUrl: string,
  extractorDependencies?: ImageSourceExtractorDependencies,
): ImageCandidate[] {
  return resolveImageSourceCandidates(html, pageUrl, extractorDependencies).map(
    ({ source, attribute }, domOrder) => ({
      id: `image-candidate-${domOrder}`,
      domOrder,
      imageUrl: source,
      sourceAttribute: attribute,
      isSelected: false,
      score: 0,
      selectionReasons: [],
      fetchStatus: 'idle',
      acquisitionMethod: 'direct',
    }),
  )
}

export function createApiImageCandidates(
  candidates: readonly ApiImageCandidate[],
): ImageCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    acquisitionMethod: 'api',
    isSelected: false,
    score: 0,
    selectionReasons: [],
    fetchStatus: 'idle',
  }))
}
