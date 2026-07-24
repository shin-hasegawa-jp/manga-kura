export type ReaderControlInteraction = 'content' | 'interactive'

export const INITIAL_READER_CONTROLS_VISIBILITY = false

/**
 * 漫画コンテンツ自体の操作だけでコントロール表示を反転する。
 * 戻るリンクや再読み込みなど、独立した操作から呼ばれた場合は状態を維持する。
 */
export function resolveReaderControlsVisibility(
  currentVisibility: boolean,
  interaction: ReaderControlInteraction,
): boolean {
  return interaction === 'content' ? !currentVisibility : currentVisibility
}

export function isReaderControlsToggleKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}
