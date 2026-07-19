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

export interface ImageCandidate {
  id: string
  domOrder: number
  imageUrl: string
  sourceAttribute: ApiImageCandidate['sourceAttribute']
  isSelected: boolean
  score: number
  selectionReasons: ImageCandidateSelectionReason[]
  fetchStatus: ImageCandidateFetchStatus
  width?: number
  height?: number
  proxyToken: string
  previewToken: string
}

export function createApiImageCandidates(
  candidates: readonly ApiImageCandidate[],
): ImageCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    isSelected: false,
    score: 0,
    selectionReasons: [],
    fetchStatus: 'idle',
  }))
}
