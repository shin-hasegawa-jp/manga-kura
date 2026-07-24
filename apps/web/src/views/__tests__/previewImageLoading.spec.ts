import { describe, expect, it } from 'vitest'
import { getPreviewImageFetchPriority, getPreviewImageLoading } from '../previewImageLoading'

describe('プレビュー画像の読み込み優先度', () => {
  it('先頭6件を即時取得し、後続候補を遅延取得する', () => {
    expect(Array.from({ length: 8 }, (_, index) => getPreviewImageLoading(index))).toEqual([
      'eager',
      'eager',
      'eager',
      'eager',
      'eager',
      'eager',
      'lazy',
      'lazy',
    ])
  })

  it('先頭2件だけを高優先度にする', () => {
    expect(Array.from({ length: 4 }, (_, index) => getPreviewImageFetchPriority(index))).toEqual([
      'high',
      'high',
      'auto',
      'auto',
    ])
  })

  it('不正な負の位置は即時取得や高優先度にしない', () => {
    expect(getPreviewImageLoading(-1)).toBe('lazy')
    expect(getPreviewImageFetchPriority(-1)).toBe('auto')
  })
})
