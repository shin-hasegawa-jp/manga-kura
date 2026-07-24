export type PreviewImageLoading = 'eager' | 'lazy'

const DEFAULT_EAGER_PREVIEW_COUNT = 6

/**
 * 最初の候補はすぐ取得し、画面外になりやすい後続候補はブラウザの
 * 遅延読み込みへ任せる。
 */
export function getPreviewImageLoading(
  index: number,
  eagerCount = DEFAULT_EAGER_PREVIEW_COUNT,
): PreviewImageLoading {
  return index >= 0 && index < eagerCount ? 'eager' : 'lazy'
}

export function getPreviewImageFetchPriority(index: number): 'high' | 'auto' {
  return index >= 0 && index < 2 ? 'high' : 'auto'
}
