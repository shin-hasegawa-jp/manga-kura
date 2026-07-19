import type { ApiImageCandidate } from '../acquisitionApiSchemas'
import { createApiImageCandidates } from '../imageCandidateFactory'
import { describe, expect, it } from 'vitest'

function createApiCandidate(
  id: string,
  domOrder: number,
  imageUrl: string,
  sourceAttribute: ApiImageCandidate['sourceAttribute'] = 'src',
): ApiImageCandidate {
  return {
    id,
    domOrder,
    imageUrl,
    sourceAttribute,
    proxyToken: `proxy-token-${id}`,
    previewToken: `preview-token-${id}`,
  }
}

describe('API画像候補モデルの生成', () => {
  it('APIレスポンスの候補情報と中継トークンを維持する', () => {
    const candidates = [
      createApiCandidate('candidate-a', 2, 'https://cdn.example.com/page-03.jpg', 'data-src'),
      createApiCandidate('candidate-b', 5, 'https://cdn.example.com/page-06.jpg', 'srcset'),
    ]

    expect(createApiImageCandidates(candidates)).toEqual([
      {
        ...candidates[0],
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
      },
      {
        ...candidates[1],
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
      },
    ])
  })

  it('APIが返したDOM順と候補順を変更しない', () => {
    const candidates = [
      createApiCandidate('candidate-9', 9, 'https://cdn.example.com/page-10.jpg'),
      createApiCandidate('candidate-1', 1, 'https://cdn.example.com/page-02.jpg'),
    ]

    expect(
      createApiImageCandidates(candidates).map(({ id, domOrder }) => ({ id, domOrder })),
    ).toEqual([
      { id: 'candidate-9', domOrder: 9 },
      { id: 'candidate-1', domOrder: 1 },
    ])
  })

  it('候補がない場合は空配列を返す', () => {
    expect(createApiImageCandidates([])).toEqual([])
  })
})
