import { describe, expect, it } from 'vitest'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import {
  moveSelectedCandidate,
  orderImageCandidatesForDisplay,
  orderImageCandidatesForSaving,
  orderSelectedImageCandidates,
  reconcileSelectedCandidateOrder,
} from '../imageCandidateOrder'

function candidate(id: string, isSelected = true): ImageCandidate {
  return {
    id,
    domOrder: Number(id),
    imageUrl: `https://example.com/${id}.jpg`,
    sourceAttribute: 'src',
    isSelected,
    score: 80,
    selectionReasons: ['large-image'],
    fetchStatus: 'loaded',
    proxyToken: `proxy-${id}`,
    previewToken: `preview-${id}`,
  }
}

describe('選択画像の保存順', () => {
  it('1つ前・1つ後ろ・先頭・末尾へ移動する', () => {
    expect(moveSelectedCandidate(['1', '2', '3'], '2', 'previous')).toEqual(['2', '1', '3'])
    expect(moveSelectedCandidate(['1', '2', '3'], '2', 'next')).toEqual(['1', '3', '2'])
    expect(moveSelectedCandidate(['1', '2', '3'], '3', 'first')).toEqual(['3', '1', '2'])
    expect(moveSelectedCandidate(['1', '2', '3'], '1', 'last')).toEqual(['2', '3', '1'])
  })

  it('端と存在しない候補の移動では順序を維持する', () => {
    expect(moveSelectedCandidate(['1', '2'], '1', 'previous')).toEqual(['1', '2'])
    expect(moveSelectedCandidate(['1', '2'], '2', 'next')).toEqual(['1', '2'])
    expect(moveSelectedCandidate(['1', '2'], 'missing', 'first')).toEqual(['1', '2'])
  })

  it('候補オブジェクトを変更せず選択画像だけを指定順に返す', () => {
    const candidates = [candidate('1'), candidate('2', false), candidate('3')]
    const ordered = orderSelectedImageCandidates(candidates, ['3', '1', '2'])
    expect(ordered).toEqual([candidates[2], candidates[0]])
    expect(ordered[0]?.proxyToken).toBe('proxy-3')
    expect(ordered[0]?.fetchStatus).toBe('loaded')
  })

  it('選択解除を除外し再選択を末尾へ追加する', () => {
    const afterClear = reconcileSelectedCandidateOrder(
      [candidate('1', false), candidate('2', false)],
      ['2', '1'],
    )
    expect(afterClear).toEqual([])
    expect(
      reconcileSelectedCandidateOrder([candidate('1'), candidate('2', false)], afterClear),
    ).toEqual(['1'])
    expect(reconcileSelectedCandidateOrder([candidate('1'), candidate('2')], ['1'])).toEqual([
      '1',
      '2',
    ])
  })

  it('保存時だけ選択画像を調整順へ並べ、未選択候補を後ろに維持する', () => {
    const candidates = [candidate('1'), candidate('2', false), candidate('3')]
    expect(orderImageCandidatesForSaving(candidates, ['3', '1']).map(({ id }) => id)).toEqual([
      '3',
      '1',
      '2',
    ])
    expect(candidates.map(({ id }) => id)).toEqual(['1', '2', '3'])
  })

  it('表示では未選択候補の位置を保ち、選択済みプレビューを調整順に入れ替える', () => {
    const candidates = [candidate('1'), candidate('2', false), candidate('3')]
    expect(orderImageCandidatesForDisplay(candidates, ['3', '1']).map(({ id }) => id)).toEqual([
      '3',
      '2',
      '1',
    ])
    expect(candidates.map(({ id }) => id)).toEqual(['1', '2', '3'])
  })
})
