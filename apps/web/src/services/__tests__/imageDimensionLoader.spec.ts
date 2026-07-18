import { describe, expect, it, vi } from 'vitest'
import type { ImageCandidate } from '../imageCandidateFactory'
import { loadImageCandidateDimensions } from '../imageDimensionLoader'

function createCandidate(id: string, imageUrl: string): ImageCandidate {
  return {
    id,
    domOrder: Number(id),
    imageUrl,
    sourceAttribute: 'src',
    isSelected: false,
    score: 0,
    selectionReasons: [],
    fetchStatus: 'idle',
  }
}

describe('画像候補のサイズ取得', () => {
  it('各候補の自然幅と自然高さを取得して読込済みにする', async () => {
    const firstCandidate = createCandidate('0', 'https://example.com/images/page-01.jpg')
    const secondCandidate = createCandidate('1', 'https://example.com/images/page-02.jpg')
    const loadImageDimensions = vi
      .fn()
      .mockResolvedValueOnce({ width: 800, height: 1200 })
      .mockResolvedValueOnce({ width: 1000, height: 1500 })

    await expect(
      loadImageCandidateDimensions([firstCandidate, secondCandidate], { loadImageDimensions }),
    ).resolves.toEqual([
      { ...firstCandidate, fetchStatus: 'loaded', width: 800, height: 1200 },
      { ...secondCandidate, fetchStatus: 'loaded', width: 1000, height: 1500 },
    ])
    expect(loadImageDimensions).toHaveBeenCalledTimes(2)
    expect(loadImageDimensions).toHaveBeenNthCalledWith(1, firstCandidate.imageUrl)
    expect(loadImageDimensions).toHaveBeenNthCalledWith(2, secondCandidate.imageUrl)
  })

  it('一部の画像が失敗しても他の候補のサイズ取得を完了する', async () => {
    const failedCandidate = createCandidate('0', 'https://example.com/images/missing.jpg')
    const loadedCandidate = createCandidate('1', 'https://example.com/images/page-02.jpg')
    const loadImageDimensions = vi
      .fn()
      .mockRejectedValueOnce(new Error('画像を読み込めませんでした'))
      .mockResolvedValueOnce({ width: 800, height: 1200 })

    await expect(
      loadImageCandidateDimensions([failedCandidate, loadedCandidate], { loadImageDimensions }),
    ).resolves.toEqual([
      { ...failedCandidate, fetchStatus: 'failed' },
      { ...loadedCandidate, fetchStatus: 'loaded', width: 800, height: 1200 },
    ])
    expect(loadImageDimensions).toHaveBeenCalledTimes(2)
  })

  it.each([
    [{ width: 0, height: 1200 }],
    [{ width: 800, height: 0 }],
    [{ width: Number.NaN, height: 1200 }],
    [{ width: 800, height: Number.POSITIVE_INFINITY }],
  ])('有効なサイズを取得できない候補を失敗状態にする', async (dimensions) => {
    const candidate = createCandidate('0', 'https://example.com/images/invalid-size.jpg')
    const loadImageDimensions = vi.fn().mockResolvedValue(dimensions)

    await expect(
      loadImageCandidateDimensions([candidate], { loadImageDimensions }),
    ).resolves.toEqual([{ ...candidate, fetchStatus: 'failed' }])
  })

  it('候補がない場合は画像読込を実行しない', async () => {
    const loadImageDimensions = vi.fn()

    await expect(loadImageCandidateDimensions([], { loadImageDimensions })).resolves.toEqual([])
    expect(loadImageDimensions).not.toHaveBeenCalled()
  })
})
