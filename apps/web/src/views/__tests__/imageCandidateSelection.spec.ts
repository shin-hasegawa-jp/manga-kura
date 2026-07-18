import { describe, expect, it } from 'vitest'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import {
  clearAllImageCandidateSelections,
  getImageCandidateSelectionState,
  selectAllImageCandidates,
  toggleImageCandidateSelection,
} from '../imageCandidateSelection'

function createCandidate(id: string, isSelected = false): ImageCandidate {
  return {
    id,
    domOrder: Number(id),
    imageUrl: `https://example.com/images/page${id}.jpg`,
    sourceAttribute: 'src',
    isSelected,
    score: 0,
    selectionReasons: [],
    fetchStatus: 'loaded',
    acquisitionMethod: 'direct',
    width: 800,
    height: 1200,
  }
}

describe('画像候補の選択状態', () => {
  it('指定した候補だけを個別に選択・解除する', () => {
    const candidates = [createCandidate('1'), createCandidate('2')]
    const selected = toggleImageCandidateSelection(candidates, '1')

    expect(selected.map(({ isSelected }) => isSelected)).toEqual([true, false])
    expect(
      toggleImageCandidateSelection(selected, '1').map(({ isSelected }) => isSelected),
    ).toEqual([false, false])
    expect(candidates.map(({ isSelected }) => isSelected)).toEqual([false, false])
  })

  it('存在しないIDでは選択状態を変更しない', () => {
    const candidates = [createCandidate('1'), createCandidate('2', true)]

    expect(toggleImageCandidateSelection(candidates, 'unknown')).toEqual(candidates)
  })

  it('すべての候補を選択する', () => {
    const candidates = [createCandidate('1'), createCandidate('2', true)]

    expect(selectAllImageCandidates(candidates).map(({ isSelected }) => isSelected)).toEqual([
      true,
      true,
    ])
  })

  it('すべての候補を解除する', () => {
    const candidates = [createCandidate('1', true), createCandidate('2', true)]

    expect(
      clearAllImageCandidateSelections(candidates).map(({ isSelected }) => isSelected),
    ).toEqual([false, false])
  })

  it('選択数と保存可否を返す', () => {
    const candidates = [
      createCandidate('1', true),
      createCandidate('2'),
      createCandidate('3', true),
    ]

    expect(getImageCandidateSelectionState(candidates)).toEqual({
      selectedCount: 2,
      totalCount: 3,
      canSave: true,
    })
  })

  it('候補が0件の場合は選択数0件かつ保存不可を返す', () => {
    expect(getImageCandidateSelectionState([])).toEqual({
      selectedCount: 0,
      totalCount: 0,
      canSave: false,
    })
  })
})
