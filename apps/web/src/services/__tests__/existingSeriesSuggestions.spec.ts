import { describe, expect, it } from 'vitest'
import type { Episode, Series } from '@/domain/models'
import { rankExistingSeriesSuggestions } from '../existingSeriesSuggestions'

const createdAt = new Date('2026-07-25T00:00:00Z')

function series(id: string, title: string): Series {
  return { id, title, createdAt, updatedAt: createdAt, episodeCount: 1 }
}

function episode(id: string, seriesId: string, sourcePageUrl: string): Episode {
  return {
    id,
    seriesId,
    title: id,
    sourcePageUrl,
    createdAt,
    updatedAt: createdAt,
    scrollPosition: 0,
    scrollProgress: 0,
  }
}

describe('既存作品候補', () => {
  it('正規化後のタイトル完全一致を最優先する', () => {
    const suggestions = rankExistingSeriesSuggestions(
      [series('matched', 'ＭＡＮＧＡ　蔵'), series('other', '別作品')],
      [],
      'manga 蔵',
      'https://example.com/comic/2',
    )

    expect(suggestions).toEqual([
      expect.objectContaining({
        series: expect.objectContaining({ id: 'matched' }),
        score: 100,
        reasons: ['exact-title'],
      }),
    ])
  })

  it('同一ホストかつ2階層以上の共通パスを候補にする', () => {
    const suggestions = rankExistingSeriesSuggestions(
      [series('matched', '作品A')],
      [episode('episode-1', 'matched', 'https://example.com/comic/series-a/1')],
      undefined,
      'https://example.com/comic/series-a/2',
    )

    expect(suggestions[0]).toMatchObject({
      score: 40,
      reasons: ['same-host', 'common-path'],
    })
  })

  it('同一ホストだけでは候補にしない', () => {
    expect(
      rankExistingSeriesSuggestions(
        [series('weak', '作品A')],
        [episode('episode-1', 'weak', 'https://example.com/other/1')],
        undefined,
        'https://example.com/comic/series-a/2',
      ),
    ).toEqual([])
  })

  it('タイトルの弱い部分一致だけでは候補にしない', () => {
    expect(
      rankExistingSeriesSuggestions(
        [series('partial', '長い作品名')],
        [],
        '作品名',
        'https://example.com/comic/2',
      ),
    ).toEqual([])
  })

  it('スコア、作品名、IDの順で候補を安定して並べる', () => {
    const suggestions = rankExistingSeriesSuggestions(
      [series('b', '同じ作品'), series('a', '同じ作品'), series('exact', '対象作品')],
      [
        episode('b-1', 'b', 'https://example.com/comic/series/1'),
        episode('a-1', 'a', 'https://example.com/comic/series/2'),
      ],
      '対象作品',
      'https://example.com/comic/series/3',
    )

    expect(suggestions.map(({ series: item }) => item.id)).toEqual(['exact', 'a', 'b'])
  })

  it('候補がない場合は空配列を返す', () => {
    expect(
      rankExistingSeriesSuggestions(
        [series('other', '別作品')],
        [],
        '対象作品',
        'https://example.com/comic/2',
      ),
    ).toEqual([])
  })
})
