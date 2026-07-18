import { describe, expect, it } from 'vitest'
import { createImageCandidates } from '../imageCandidateFactory'

describe('画像候補モデルの生成', () => {
  it('抽出結果をDOM順で画像候補へ変換する', () => {
    const html = `
      <img src="/images/page-01.jpg">
      <img data-src="/images/page-02.jpg" src="placeholder.gif">
      <img srcset="/images/page-03.jpg 1x, /images/page-03@2x.jpg 2x">
    `

    expect(createImageCandidates(html, 'https://example.com/comic/1')).toEqual([
      {
        id: 'image-candidate-0',
        domOrder: 0,
        imageUrl: 'https://example.com/images/page-01.jpg',
        sourceAttribute: 'src',
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
        acquisitionMethod: 'direct',
      },
      {
        id: 'image-candidate-1',
        domOrder: 1,
        imageUrl: 'https://example.com/images/page-02.jpg',
        sourceAttribute: 'data-src',
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
        acquisitionMethod: 'direct',
      },
      {
        id: 'image-candidate-2',
        domOrder: 2,
        imageUrl: 'https://example.com/images/page-03@2x.jpg',
        sourceAttribute: 'srcset',
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
        acquisitionMethod: 'direct',
      },
    ])
  })

  it('各候補へ一覧内で一意なIDを割り当てる', () => {
    const html = `
      <img src="/images/page-01.jpg">
      <img src="/images/page-02.jpg">
      <img src="/images/page-03.jpg">
    `
    const candidates = createImageCandidates(html, 'https://example.com/comic/1')

    expect(new Set(candidates.map(({ id }) => id)).size).toBe(candidates.length)
  })

  it('重複や利用できないURLを除外した後も候補順を連番にする', () => {
    const html = `
      <img src="data:image/png;base64,placeholder">
      <img src="/images/page-01.jpg">
      <img src="https://example.com/images/page-01.jpg">
      <img data-original="/images/page-02.jpg">
    `

    expect(createImageCandidates(html, 'https://example.com/comic/1')).toEqual([
      {
        id: 'image-candidate-0',
        domOrder: 0,
        imageUrl: 'https://example.com/images/page-01.jpg',
        sourceAttribute: 'src',
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
        acquisitionMethod: 'direct',
      },
      {
        id: 'image-candidate-1',
        domOrder: 1,
        imageUrl: 'https://example.com/images/page-02.jpg',
        sourceAttribute: 'data-original',
        isSelected: false,
        score: 0,
        selectionReasons: [],
        fetchStatus: 'idle',
        acquisitionMethod: 'direct',
      },
    ])
  })

  it('抽出可能な画像がない場合は空の候補一覧を返す', () => {
    expect(
      createImageCandidates('<main><p>画像なし</p></main>', 'https://example.com/comic/1'),
    ).toEqual([])
  })
})
