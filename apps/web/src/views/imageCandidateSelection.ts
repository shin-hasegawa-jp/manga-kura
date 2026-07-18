import type { ImageCandidate } from '@/services/imageCandidateFactory'

export interface ImageCandidateSelectionState {
  selectedCount: number
  totalCount: number
  canSave: boolean
}

export function toggleImageCandidateSelection(
  candidates: readonly ImageCandidate[],
  candidateId: string,
): ImageCandidate[] {
  return candidates.map((candidate) =>
    candidate.id === candidateId ? { ...candidate, isSelected: !candidate.isSelected } : candidate,
  )
}

export function selectAllImageCandidates(candidates: readonly ImageCandidate[]): ImageCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, isSelected: true }))
}

export function clearAllImageCandidateSelections(
  candidates: readonly ImageCandidate[],
): ImageCandidate[] {
  return candidates.map((candidate) => ({ ...candidate, isSelected: false }))
}

export function getImageCandidateSelectionState(
  candidates: readonly ImageCandidate[],
): ImageCandidateSelectionState {
  const selectedCount = candidates.filter(({ isSelected }) => isSelected).length

  return {
    selectedCount,
    totalCount: candidates.length,
    canSave: selectedCount > 0,
  }
}
