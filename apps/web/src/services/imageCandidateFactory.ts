import {
  resolveImageSourceCandidates,
  type ImageSourceAttribute,
  type ImageSourceExtractorDependencies,
} from './imageSourceExtractor'

export type ImageCandidateFetchStatus = 'idle' | 'loading' | 'loaded' | 'failed'

export interface ImageCandidate {
  id: string
  domOrder: number
  imageUrl: string
  sourceAttribute: ImageSourceAttribute
  isSelected: boolean
  fetchStatus: ImageCandidateFetchStatus
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
      fetchStatus: 'idle',
    }),
  )
}
