import { describe, expect, it } from 'vitest'
import type { Episode, Series } from '@/domain/models'
import { buildLibrarySearchIndex, normalizeSearchText } from '../librarySearch'

const baseDate = new Date('2026-07-01T00:00:00.000Z')

function createSeries(overrides: Pick<Series, 'id' | 'title'>): Series {
  return { createdAt: baseDate, updatedAt: baseDate, episodeCount: 0, ...overrides }
}

function createEpisode(
  overrides: Pick<Episode, 'id' | 'title' | 'sourcePageUrl'> & Partial<Episode>,
): Episode {
  return {
    createdAt: baseDate,
    updatedAt: baseDate,
    scrollPosition: 0,
    scrollProgress: 0,
    ...overrides,
  }
}

describe('検索対象テキストの正規化', () => {
  it('前後空白を除いて小文字化する', () => {
    expect(normalizeSearchText('  Example URL  ')).toBe('example url')
  })
})

describe('検索インデックスの生成', () => {
  it('作品には作品タイトルと所属話のタイトル・掲載元URLを含める', () => {
    const series = createSeries({ id: 'series-1', title: '冒険譚' })
    const episodes = [
      createEpisode({
        id: 'ep-1',
        seriesId: 'series-1',
        title: '出発の朝',
        sourcePageUrl: 'https://Example.com/Adventure/1',
      }),
      createEpisode({
        id: 'ep-2',
        seriesId: 'series-1',
        title: '森の入口',
        sourcePageUrl: 'https://example.com/adventure/2',
      }),
    ]

    const index = buildLibrarySearchIndex([series], episodes)

    expect(index.get('series-1')).toBe(
      '冒険譚 出発の朝 https://example.com/adventure/1 森の入口 https://example.com/adventure/2',
    )
  })

  it('単独の話には話タイトルと掲載元URLを含める', () => {
    const episode = createEpisode({
      id: 'standalone-1',
      title: '読み切り',
      sourcePageUrl: 'https://example.com/oneshot',
    })

    const index = buildLibrarySearchIndex([], [episode])

    expect(index.get('standalone-1')).toBe('読み切り https://example.com/oneshot')
    expect(index.size).toBe(1)
  })

  it('話がない作品は作品タイトルだけを対象にする', () => {
    const series = createSeries({ id: 'empty-series', title: '未着手作品' })

    expect(buildLibrarySearchIndex([series], []).get('empty-series')).toBe('未着手作品')
  })
})
