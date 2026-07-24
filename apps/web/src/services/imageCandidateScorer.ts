import type { ImageCandidate, ImageCandidateSelectionReason } from './imageCandidateFactory'
import { extractImageSequenceFilename } from './imageSequenceDetector'

export const DEFAULT_IMAGE_SELECTION_SCORE_THRESHOLD = 50

const DECORATIVE_FILENAME_PATTERN =
  /(?:^|[-_.])(logo|icon|favicon|avatar|badge|button|banner|advert?|sprite)(?:[-_.]|\d|$)/i

interface CandidateContext {
  candidate: ImageCandidate
  directoryKey?: string
  sequenceKey?: string
  sequenceNumber?: number
}

interface ScoreAdjustment {
  points: number
  reason: ImageCandidateSelectionReason
}

function getUrlContext(candidate: ImageCandidate): CandidateContext {
  let url: URL

  try {
    url = new URL(candidate.imageUrl)
  } catch {
    return { candidate }
  }

  const lastSlashIndex = url.pathname.lastIndexOf('/')
  const directoryKey = `${url.origin}${url.pathname.slice(0, lastSlashIndex + 1)}`
  const sequenceFilename = extractImageSequenceFilename(candidate.imageUrl)

  if (sequenceFilename === undefined) {
    return { candidate, directoryKey }
  }

  return {
    candidate,
    directoryKey,
    sequenceKey: `${sequenceFilename.prefix}\u0000${sequenceFilename.extension}`,
    sequenceNumber: sequenceFilename.number,
  }
}

function getRepeatedKeys(
  contexts: readonly CandidateContext[],
  selectKey: (context: CandidateContext) => string | undefined,
  minimumCount = 2,
): Set<string> {
  const counts = new Map<string, number>()

  for (const context of contexts) {
    const key = selectKey(context)
    if (key !== undefined) {
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return new Set(
    [...counts.entries()].filter(([, count]) => count >= minimumCount).map(([key]) => key),
  )
}

function getCommonCssClasses(contexts: readonly CandidateContext[]): Set<string> {
  const counts = new Map<string, number>()

  for (const { candidate } of contexts) {
    for (const cssClass of new Set(candidate.cssClasses ?? [])) {
      counts.set(cssClass, (counts.get(cssClass) ?? 0) + 1)
    }
  }

  return new Set(
    [...counts.entries()].filter(([, count]) => count >= 3).map(([cssClass]) => cssClass),
  )
}

function getSequentialKeys(contexts: readonly CandidateContext[]): Set<string> {
  const numbersByKey = new Map<string, Set<number>>()

  for (const { sequenceKey, sequenceNumber } of contexts) {
    if (sequenceKey === undefined || sequenceNumber === undefined) {
      continue
    }
    const numbers = numbersByKey.get(sequenceKey) ?? new Set<number>()
    numbers.add(sequenceNumber)
    numbersByKey.set(sequenceKey, numbers)
  }

  const sequentialKeys = new Set<string>()
  for (const [key, numbers] of numbersByKey) {
    const sortedNumbers = [...numbers].sort((left, right) => left - right)
    if (
      sortedNumbers.some(
        (number, index) => index > 0 && number === (sortedNumbers[index - 1] ?? number) + 1,
      )
    ) {
      sequentialKeys.add(key)
    }
  }
  return sequentialKeys
}

function hasContinuousDomNeighbor(
  context: CandidateContext,
  contexts: readonly CandidateContext[],
): boolean {
  if (context.sequenceKey === undefined) {
    return false
  }

  return contexts.some(
    (other) =>
      other.candidate.id !== context.candidate.id &&
      other.sequenceKey === context.sequenceKey &&
      Math.abs(other.candidate.domOrder - context.candidate.domOrder) === 1,
  )
}

function getDimensionAdjustments(candidate: ImageCandidate): ScoreAdjustment[] {
  if (candidate.fetchStatus === 'failed') {
    return [{ points: -100, reason: 'image-load-failed' }]
  }
  if (candidate.width === undefined || candidate.height === undefined) {
    return []
  }

  const adjustments: ScoreAdjustment[] = []
  const aspectRatio = candidate.height / candidate.width

  if (candidate.width < 300 || candidate.height < 300) {
    adjustments.push({ points: -50, reason: 'small-image' })
  } else if (candidate.width >= 600 && candidate.height >= 800) {
    adjustments.push({ points: 20, reason: 'large-image' })
  }

  if (aspectRatio < 0.6) {
    adjustments.push({ points: -50, reason: 'extremely-wide-image' })
  } else if (aspectRatio >= 1.15 && aspectRatio <= 3) {
    adjustments.push({ points: 15, reason: 'portrait-aspect-ratio' })
  }

  return adjustments
}

function hasDecorativeFilename(imageUrl: string): boolean {
  try {
    const url = new URL(imageUrl)
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    return DECORATIVE_FILENAME_PATTERN.test(filename)
  } catch {
    return false
  }
}

export function scoreAndSelectImageCandidates(
  candidates: readonly ImageCandidate[],
  selectionThreshold = DEFAULT_IMAGE_SELECTION_SCORE_THRESHOLD,
): ImageCandidate[] {
  const contexts = candidates.map(getUrlContext)
  const commonDirectoryKeys = getRepeatedKeys(contexts, ({ directoryKey }) => directoryKey)
  const commonParentGroupIds = getRepeatedKeys(
    contexts,
    ({ candidate }) => candidate.parentGroupId ?? undefined,
  )
  const commonCssClasses = getCommonCssClasses(contexts)
  const sequentialKeys = getSequentialKeys(contexts)

  return contexts.map((context) => {
    const adjustments: ScoreAdjustment[] = []

    if (context.sequenceKey !== undefined && sequentialKeys.has(context.sequenceKey)) {
      adjustments.push({ points: 30, reason: 'sequential-filename' })
      if (hasContinuousDomNeighbor(context, contexts)) {
        adjustments.push({ points: 15, reason: 'continuous-dom-order' })
      }
    }
    if (context.directoryKey !== undefined && commonDirectoryKeys.has(context.directoryKey)) {
      adjustments.push({ points: 10, reason: 'common-url-path' })
    }
    if (
      context.candidate.parentGroupId !== undefined &&
      context.candidate.parentGroupId !== null &&
      commonParentGroupIds.has(context.candidate.parentGroupId)
    ) {
      adjustments.push({ points: 15, reason: 'same-parent-group' })
    }
    if ((context.candidate.cssClasses ?? []).some((cssClass) => commonCssClasses.has(cssClass))) {
      adjustments.push({ points: 10, reason: 'common-css-class' })
    }
    adjustments.push(...getDimensionAdjustments(context.candidate))
    if (hasDecorativeFilename(context.candidate.imageUrl)) {
      adjustments.push({ points: -60, reason: 'decorative-filename' })
    }

    const score = adjustments.reduce((total, adjustment) => total + adjustment.points, 0)
    return {
      ...context.candidate,
      score,
      selectionReasons: adjustments.map(({ reason }) => reason),
      isSelected: score >= selectionThreshold,
    }
  })
}
