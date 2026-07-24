import { describe, expect, it } from 'vitest'
import type { ImageCandidate } from '../imageCandidateFactory'
import {
  DEFAULT_IMAGE_SELECTION_SCORE_THRESHOLD,
  scoreAndSelectImageCandidates,
} from '../imageCandidateScorer'

function createCandidate(
  id: string,
  domOrder: number,
  imageUrl: string,
  width: number,
  height: number,
  domContext: {
    parentGroupId?: string | null
    cssClasses?: readonly string[]
  } = {},
): ImageCandidate {
  return {
    id,
    domOrder,
    imageUrl,
    sourceAttribute: 'src',
    ...domContext,
    isSelected: false,
    score: 0,
    selectionReasons: [],
    fetchStatus: 'loaded',
    proxyToken: `proxy-token-${id}`,
    previewToken: `preview-token-${id}`,
    width,
    height,
  }
}

describe('画像候補のデフォルト選択スコア', () => {
  it('漫画ページらしい連番画像をデフォルト選択する', () => {
    const candidates = [
      createCandidate('page-1', 0, 'https://cdn.example.com/comic/page001.jpg', 800, 1200),
      createCandidate('page-2', 1, 'https://cdn.example.com/comic/page002.jpg', 800, 1200),
      createCandidate('page-3', 2, 'https://cdn.example.com/comic/page003.jpg', 800, 1200),
    ]

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(scored.every(({ isSelected }) => isSelected)).toBe(true)
    expect(scored.every(({ score }) => score >= DEFAULT_IMAGE_SELECTION_SCORE_THRESHOLD)).toBe(true)
    expect(scored[0]?.selectionReasons).toEqual([
      'sequential-filename',
      'continuous-dom-order',
      'common-url-path',
      'large-image',
      'portrait-aspect-ratio',
    ])
  })

  it('DOM上で離れた連番候補には連続性の加点をしない', () => {
    const candidates = [
      createCandidate('page-1', 0, 'https://example.com/comic/page01.jpg', 800, 1200),
      createCandidate('page-2', 4, 'https://example.com/comic/page02.jpg', 800, 1200),
    ]

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(scored[0]?.selectionReasons).not.toContain('continuous-dom-order')
    expect(scored[1]?.selectionReasons).not.toContain('continuous-dom-order')
  })

  it('一部の欠番や末尾の外れ値があっても連番候補として扱う', () => {
    const candidates = [1, 2, 3, 5, 15].map((number, domOrder) =>
      createCandidate(
        `page-${number}`,
        domOrder,
        `https://example.com/comic/${number}.jpg`,
        800,
        1200,
      ),
    )

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(
      scored.every(({ selectionReasons }) => selectionReasons.includes('sequential-filename')),
    ).toBe(true)
  })

  it('共通URLパスを持つ候補へ加点する', () => {
    const candidates = [
      createCandidate('cover', 0, 'https://example.com/comic/cover.jpg', 700, 1000),
      createCandidate('back', 1, 'https://example.com/comic/back.jpg', 700, 1000),
      createCandidate('other', 2, 'https://example.com/assets/other.jpg', 700, 1000),
    ]

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(scored[0]?.selectionReasons).toContain('common-url-path')
    expect(scored[1]?.selectionReasons).toContain('common-url-path')
    expect(scored[2]?.selectionReasons).not.toContain('common-url-path')
  })

  it('同じ親要素の大きな縦長画像をグループとして初期選択する', () => {
    const candidates = [
      createCandidate('page-1', 0, 'https://cdn-a.example.com/first.jpg', 800, 1200, {
        parentGroupId: 'image-parent-0',
      }),
      createCandidate('page-2', 1, 'https://cdn-b.example.com/second.jpg', 800, 1200, {
        parentGroupId: 'image-parent-0',
      }),
    ]

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(scored.every(({ isSelected }) => isSelected)).toBe(true)
    expect(
      scored.every(({ selectionReasons }) => selectionReasons.includes('same-parent-group')),
    ).toBe(true)
  })

  it('3件以上に共通するCSSクラスをグループ判定へ利用する', () => {
    const candidates = [1, 2, 3].map((number) =>
      createCandidate(
        `page-${number}`,
        number - 1,
        `https://example.com/comic-${number}/page.jpg`,
        800,
        1200,
        { cssClasses: ['comic-page'] },
      ),
    )

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(
      scored.every(({ selectionReasons }) => selectionReasons.includes('common-css-class')),
    ).toBe(true)
    expect(scored.every(({ isSelected }) => isSelected)).toBe(false)
  })

  it('2件だけの共通CSSクラスをグループ根拠にしない', () => {
    const candidates = [1, 2].map((number) =>
      createCandidate(
        `image-${number}`,
        number - 1,
        `https://cdn-${number}.example.com/image.jpg`,
        800,
        1200,
        { cssClasses: ['responsive-image'] },
      ),
    )

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(
      scored.every(({ selectionReasons }) => !selectionReasons.includes('common-css-class')),
    ).toBe(true)
  })

  it('別の親要素にある広告を漫画画像グループへ含めない', () => {
    const candidates = [
      createCandidate('page-1', 0, 'https://example.com/comic/01.jpg', 800, 1200, {
        parentGroupId: 'image-parent-0',
        cssClasses: ['comic-page'],
      }),
      createCandidate('page-2', 1, 'https://example.com/comic/02.jpg', 800, 1200, {
        parentGroupId: 'image-parent-0',
        cssClasses: ['comic-page'],
      }),
      createCandidate('page-3', 2, 'https://example.com/comic/03.jpg', 800, 1200, {
        parentGroupId: 'image-parent-0',
        cssClasses: ['comic-page'],
      }),
      createCandidate('advert', 3, 'https://example.com/ads/banner.jpg', 1200, 250, {
        parentGroupId: 'image-parent-1',
        cssClasses: ['responsive-image'],
      }),
    ]

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(scored.filter(({ isSelected }) => isSelected).map(({ id }) => id)).toEqual([
      'page-1',
      'page-2',
      'page-3',
    ])
    expect(scored[3]?.selectionReasons).not.toContain('same-parent-group')
    expect(scored[3]?.selectionReasons).not.toContain('common-css-class')
  })

  it('DOM情報がない候補は既存の判定結果を維持する', () => {
    const candidates = [
      createCandidate('page-1', 0, 'https://example.com/comic/page01.jpg', 800, 1200),
      createCandidate('page-2', 1, 'https://example.com/comic/page02.jpg', 800, 1200),
    ]

    expect(scoreAndSelectImageCandidates(candidates).every(({ isSelected }) => isSelected)).toBe(
      true,
    )
  })

  it('ロゴ・広告・サムネイルが混在しても漫画ページだけを初期選択する', () => {
    const candidates = [
      createCandidate('logo', 0, 'https://example.com/assets/site-logo.png', 240, 80),
      createCandidate('page-1', 1, 'https://example.com/comic/page01.jpg', 900, 1400),
      createCandidate('page-2', 2, 'https://example.com/comic/page02.jpg', 900, 1400),
      createCandidate('page-3', 3, 'https://example.com/comic/page03.jpg', 900, 1400),
      createCandidate('advert', 4, 'https://example.com/ads/advert-01.jpg', 1200, 250),
      createCandidate('thumbnail', 5, 'https://example.com/thumbs/thumbnail.jpg', 240, 320),
    ]

    const scored = scoreAndSelectImageCandidates(candidates)

    expect(scored.filter(({ isSelected }) => isSelected).map(({ id }) => id)).toEqual([
      'page-1',
      'page-2',
      'page-3',
    ])
    expect(scored.find(({ id }) => id === 'logo')?.selectionReasons).toEqual(
      expect.arrayContaining(['small-image', 'extremely-wide-image', 'decorative-filename']),
    )
    expect(scored.find(({ id }) => id === 'advert')?.selectionReasons).toContain(
      'extremely-wide-image',
    )
    expect(scored.find(({ id }) => id === 'thumbnail')?.selectionReasons).toContain('small-image')
  })

  it('読込失敗した画像を初期選択しない', () => {
    const failedCandidate: ImageCandidate = {
      ...createCandidate('failed', 0, 'https://example.com/comic/page01.jpg', 800, 1200),
      fetchStatus: 'failed',
      width: undefined,
      height: undefined,
    }

    expect(scoreAndSelectImageCandidates([failedCandidate])).toEqual([
      {
        ...failedCandidate,
        score: -100,
        selectionReasons: ['image-load-failed'],
        isSelected: false,
      },
    ])
  })

  it('指定した閾値をデフォルト選択へ使用する', () => {
    const candidate = createCandidate(
      'portrait',
      0,
      'https://example.com/single/portrait.jpg',
      800,
      1200,
    )

    expect(scoreAndSelectImageCandidates([candidate], 35)[0]?.isSelected).toBe(true)
    expect(scoreAndSelectImageCandidates([candidate], 36)[0]?.isSelected).toBe(false)
  })
})
