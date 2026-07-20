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
