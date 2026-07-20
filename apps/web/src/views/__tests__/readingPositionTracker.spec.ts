import { describe, expect, it } from 'vitest'
import {
  computeReadingPosition,
  resolveRestoreScrollTop,
  shouldPersistReadingPosition,
} from '../readingPositionTracker'

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

describe('閲覧位置の復元', () => {
  it('コンテンツ高さがほぼ同じなら保存済みscrollTopを適用する', () => {
    expect(
      resolveRestoreScrollTop(
        { scrollPosition: 1200, scrollProgress: 0.5, savedContentHeight: 2400 },
        { contentHeight: 2440, scrollableHeight: 2000 },
      ),
    ).toBe(1200)
  })

  it('コンテンツ高さが大きくずれる場合は進捗率で復元する', () => {
    expect(
      resolveRestoreScrollTop(
        { scrollPosition: 1200, scrollProgress: 0.5, savedContentHeight: 2400 },
        { contentHeight: 4800, scrollableHeight: 4000 },
      ),
    ).toBe(2000)
  })

  it('保存時コンテンツ高さがない場合は進捗率で復元する', () => {
    expect(
      resolveRestoreScrollTop(
        { scrollPosition: 1200, scrollProgress: 0.25 },
        { contentHeight: 4800, scrollableHeight: 4000 },
      ),
    ).toBe(1000)
  })

  it('復元先を現在のスクロール可能範囲へ収める', () => {
    expect(
      resolveRestoreScrollTop(
        { scrollPosition: 5000, scrollProgress: 0.9, savedContentHeight: 6000 },
        { contentHeight: 6000, scrollableHeight: 2000 },
      ),
    ).toBe(2000)
  })

  it('保存位置が先頭やスクロール不可のときは復元しない', () => {
    expect(
      resolveRestoreScrollTop(
        { scrollPosition: 0, scrollProgress: 0, savedContentHeight: 2400 },
        { contentHeight: 2400, scrollableHeight: 2000 },
      ),
    ).toBe(0)
    expect(
      resolveRestoreScrollTop(
        { scrollPosition: 1200, scrollProgress: 0.5, savedContentHeight: 2400 },
        { contentHeight: 800, scrollableHeight: 0 },
      ),
    ).toBe(0)
  })
})
