import type { ImageCandidate } from '@/services/imageCandidateFactory'

export type ImageCandidateMove = 'previous' | 'next' | 'first' | 'last'

export function reconcileSelectedCandidateOrder(
  candidates: readonly ImageCandidate[],
  currentOrder: readonly string[],
): string[] {
  const selectedIds = new Set(candidates.filter(({ isSelected }) => isSelected).map(({ id }) => id))
  const retained = currentOrder.filter((id) => selectedIds.delete(id))
  const newlySelected = candidates.filter(({ id }) => selectedIds.has(id)).map(({ id }) => id)
  return [...retained, ...newlySelected]
}

export function moveSelectedCandidate(
  order: readonly string[],
  candidateId: string,
  move: ImageCandidateMove,
): string[] {
  const currentIndex = order.indexOf(candidateId)
  if (currentIndex < 0 || order.length < 2) return [...order]

  const targetIndex =
    move === 'first'
      ? 0
      : move === 'last'
        ? order.length - 1
        : move === 'previous'
          ? Math.max(0, currentIndex - 1)
          : Math.min(order.length - 1, currentIndex + 1)

  if (targetIndex === currentIndex) return [...order]
  const next = [...order]
  const [candidate] = next.splice(currentIndex, 1)
  if (candidate !== undefined) next.splice(targetIndex, 0, candidate)
  return next
}

export function orderSelectedImageCandidates(
  candidates: readonly ImageCandidate[],
  selectedOrder: readonly string[],
): ImageCandidate[] {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  return selectedOrder.flatMap((id) => {
    const candidate = candidatesById.get(id)
    return candidate?.isSelected === true ? [candidate] : []
  })
}

export function orderImageCandidatesForSaving(
  candidates: readonly ImageCandidate[],
  selectedOrder: readonly string[],
): ImageCandidate[] {
  const orderedSelected = orderSelectedImageCandidates(candidates, selectedOrder)
  const selectedIds = new Set(orderedSelected.map(({ id }) => id))
  return [...orderedSelected, ...candidates.filter(({ id }) => !selectedIds.has(id))]
}

export function orderImageCandidatesForDisplay(
  candidates: readonly ImageCandidate[],
  selectedOrder: readonly string[],
): ImageCandidate[] {
  const orderedSelected = orderSelectedImageCandidates(candidates, selectedOrder)
  let selectedIndex = 0
  return candidates.map((candidate) => {
    if (!candidate.isSelected) return candidate
    const orderedCandidate = orderedSelected[selectedIndex]
    selectedIndex += 1
    return orderedCandidate ?? candidate
  })
}
