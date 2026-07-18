import {
  resolveImageSourceCandidates,
  type ImageSourceAttribute,
  type ImageSourceExtractorDependencies,
} from './imageSourceExtractor'

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

export interface ImageCandidate {
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
    }),
  )
}
