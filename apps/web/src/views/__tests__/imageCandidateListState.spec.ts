import { describe, expect, it } from 'vitest'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import { getImageCandidateListState } from '../imageCandidateListState'

function createCandidate(fetchStatus: ImageCandidate['fetchStatus'] = 'loaded'): ImageCandidate {
  return {
    id: 'image-candidate-0',
    domOrder: 0,
    imageUrl: 'https://example.com/images/page01.jpg',
    sourceAttribute: 'src',
    isSelected: true,
    score: 90,
    selectionReasons: ['sequential-filename'],
    fetchStatus,
    acquisitionMethod: 'direct',
    width: fetchStatus === 'loaded' ? 800 : undefined,
    height: fetchStatus === 'loaded' ? 1200 : undefined,
  }
}

describe('画像候補一覧の表示状態', () => {
  it('未解析の場合は初期状態を返す', () => {
    expect(getImageCandidateListState(undefined)).toEqual({ kind: 'idle' })
  })

  it('解析中の場合は読込状態を返す', () => {
    expect(getImageCandidateListState({ status: 'analyzing' })).toEqual({ kind: 'loading' })
  })

  it('候補が0件の場合は対象URLを持つ空状態を返す', () => {
    expect(
      getImageCandidateListState({
        status: 'empty',
        pageUrl: 'https://example.com/comic/',
        acquisitionMethod: 'direct',
      }),
    ).toEqual({
      kind: 'empty',
      pageUrl: 'https://example.com/comic/',
      message: 'このページから画像候補を抽出できませんでした。URLを確認して再解析できます。',
    })
  })

  it('解析失敗の場合はエラーメッセージを返す', () => {
    expect(
      getImageCandidateListState({
        status: 'failure',
        kind: 'html-fetch-failed',
        message: 'ページを取得できませんでした。',
      }),
    ).toEqual({ kind: 'failure', message: 'ページを取得できませんでした。' })
  })

  it('解析成功の場合は取得失敗を含む候補を順序を変えずに返す', () => {
    const candidates = [createCandidate(), createCandidate('failed')]

    expect(
      getImageCandidateListState({
        status: 'success',
        pageUrl: 'https://example.com/comic/',
        acquisitionMethod: 'direct',
        candidates,
      }),
    ).toEqual({
      kind: 'populated',
      pageUrl: 'https://example.com/comic/',
      candidates,
    })
  })
})
