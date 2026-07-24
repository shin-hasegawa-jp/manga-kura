import { describe, expect, it } from 'vitest'
import {
  INITIAL_READER_CONTROLS_VISIBILITY,
  isReaderControlsToggleKey,
  resolveReaderControlsVisibility,
} from '../readerControls'

describe('閲覧コントロールの表示状態', () => {
  it('初期状態は非表示にする', () => {
    expect(INITIAL_READER_CONTROLS_VISIBILITY).toBe(false)
  })

  it('漫画コンテンツの操作で表示状態を反転する', () => {
    expect(resolveReaderControlsVisibility(false, 'content')).toBe(true)
    expect(resolveReaderControlsVisibility(true, 'content')).toBe(false)
  })

  it('独立した操作では表示状態を変更しない', () => {
    expect(resolveReaderControlsVisibility(false, 'interactive')).toBe(false)
    expect(resolveReaderControlsVisibility(true, 'interactive')).toBe(true)
  })

  it.each([
    ['Enter', true],
    [' ', true],
    ['Escape', false],
    ['ArrowDown', false],
  ])('%sキーの切り替え可否を判定する', (key, expected) => {
    expect(isReaderControlsToggleKey(key)).toBe(expected)
  })
})
