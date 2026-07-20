import { describe, expect, it } from 'vitest'
import { computeReadingPosition, shouldPersistReadingPosition } from '../readingPositionTracker'

describe('閲覧位置の測定', () => {
  it('スクロール位置から進捗率と保存時コンテンツ高さを求める', () => {
    expect(computeReadingPosition(600, 2400, 3200)).toEqual({
      scrollPosition: 600,
      scrollProgress: 0.25,
      savedContentHeight: 3200,
    })
  })

  it('スクロールできない場合は進捗率を0にする', () => {
    expect(computeReadingPosition(0, 0, 800)).toEqual({
      scrollPosition: 0,
      scrollProgress: 0,
      savedContentHeight: 800,
    })
  })

  it('負のスクロール位置や超過位置を0〜1の範囲へ収める', () => {
    expect(computeReadingPosition(-100, 2000, 3000)).toEqual({
      scrollPosition: 0,
      scrollProgress: 0,
      savedContentHeight: 3000,
    })
    expect(computeReadingPosition(5000, 2000, 3000)).toEqual({
      scrollPosition: 5000,
      scrollProgress: 1,
      savedContentHeight: 3000,
    })
  })
})

describe('閲覧位置の保存間隔判定', () => {
  it('前回保存がない場合は保存する', () => {
    expect(shouldPersistReadingPosition(undefined, 10_000, 2000)).toBe(true)
  })

  it('前回保存から間隔以上経過したときだけ保存する', () => {
    expect(shouldPersistReadingPosition(10_000, 12_000, 2000)).toBe(true)
    expect(shouldPersistReadingPosition(10_000, 11_500, 2000)).toBe(false)
  })
})
