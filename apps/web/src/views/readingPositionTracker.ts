export interface ReadingPositionMeasurement {
  scrollPosition: number
  scrollProgress: number
  savedContentHeight: number
}

/**
 * 現在のスクロール状態から、保存する閲覧位置（scrollTop・進捗率・
 * 保存時コンテンツ高さ）を求める。進捗率はスクロール可能な全体高さに対する
 * 割合で、0〜1へ収める。
 */
export function computeReadingPosition(
  scrollTop: number,
  scrollableHeight: number,
  contentHeight: number,
): ReadingPositionMeasurement {
  const boundedScrollTop = Math.max(0, scrollTop)
  const scrollProgress =
    scrollableHeight <= 0 ? 0 : Math.min(1, Math.max(0, boundedScrollTop / scrollableHeight))

  return {
    scrollPosition: boundedScrollTop,
    scrollProgress,
    savedContentHeight: Math.max(0, contentHeight),
  }
}

/**
 * 一定間隔での保存を判定する。前回保存がない場合、または前回保存から
 * 指定間隔以上経過している場合だけ保存する（スクロールイベントごとには
 * 保存しない）。
 */
export function shouldPersistReadingPosition(
  lastPersistedAt: number | undefined,
  now: number,
  intervalMs: number,
): boolean {
  if (lastPersistedAt === undefined) return true

  return now - lastPersistedAt >= intervalMs
}

export interface SavedReadingPosition {
  scrollPosition: number
  scrollProgress: number
  savedContentHeight?: number
}

export interface ReaderLayout {
  contentHeight: number
  scrollableHeight: number
}

// 保存時と現在のコンテンツ高さの差がこの割合以内なら、保存済み scrollTop を
// そのまま適用する。超える場合は進捗率で復元する。
const CONTENT_HEIGHT_TOLERANCE_RATIO = 0.05

/**
 * 次回閲覧時に適用するスクロール位置を求める。保存時とコンテンツ高さが
 * ほぼ同じなら保存済み scrollTop を優先し、大きくずれる場合は進捗率で
 * 復元する。結果は現在のスクロール可能範囲へ収める。
 */
export function resolveRestoreScrollTop(saved: SavedReadingPosition, layout: ReaderLayout): number {
  const scrollableHeight = Math.max(0, layout.scrollableHeight)
  if (saved.scrollPosition <= 0 || scrollableHeight <= 0) return 0

  const heightIsStable =
    saved.savedContentHeight !== undefined &&
    saved.savedContentHeight > 0 &&
    Math.abs(layout.contentHeight - saved.savedContentHeight) <=
      saved.savedContentHeight * CONTENT_HEIGHT_TOLERANCE_RATIO

  const target = heightIsStable ? saved.scrollPosition : saved.scrollProgress * scrollableHeight

  return Math.min(scrollableHeight, Math.max(0, target))
}
