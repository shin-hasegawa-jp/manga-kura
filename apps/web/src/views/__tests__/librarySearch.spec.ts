import { describe, expect, it } from 'vitest'
import type { Episode, Series } from '@/domain/models'
import type { TopLevelLibraryEntry } from '@/database/repository'
import { filterLibraryEntries } from '../librarySearch'

const baseDate = new Date('2026-07-01T00:00:00.000Z')

function seriesEntry(id: string, title: string): TopLevelLibraryEntry {
  const series: Series = { id, title, createdAt: baseDate, updatedAt: baseDate, episodeCount: 1 }
  return { kind: 'series', series, episodeCount: 1 }
}

function standaloneEntry(id: string, title: string): TopLevelLibraryEntry {
  const episode: Episode = {
    id,
    title,
    sourcePageUrl: 'https://example.com/oneshot',
    createdAt: baseDate,
    updatedAt: baseDate,
    scrollPosition: 0,
    scrollProgress: 0,
  }
  return { kind: 'standaloneEpisode', episode }
}

const entries = [seriesEntry('series-1', '冒険譚'), standaloneEntry('standalone-1', '読み切り')]
const index = new Map<string, string>([
  ['series-1', '冒険譚 出発の朝 https://example.com/adventure/1'],
  ['standalone-1', '読み切り https://example.com/oneshot'],
])

function idsOf(result: readonly TopLevelLibraryEntry[]): string[] {
  return result.map((entry) => (entry.kind === 'series' ? entry.series.id : entry.episode.id))
}

describe('本棚の検索フィルタ', () => {
  it('空語のときは全件を返し、入力配列は変更しない', () => {
    expect(idsOf(filterLibraryEntries(entries, '   ', index))).toEqual(['series-1', 'standalone-1'])
    expect(idsOf(entries)).toEqual(['series-1', 'standalone-1'])
  })

  it('作品タイトルに一致する項目を返す', () => {
    expect(idsOf(filterLibraryEntries(entries, '冒険', index))).toEqual(['series-1'])
  })

  it('所属話のタイトルや掲載元URLに一致する作品を返す', () => {
    expect(idsOf(filterLibraryEntries(entries, '出発', index))).toEqual(['series-1'])
    expect(idsOf(filterLibraryEntries(entries, 'ADVENTURE', index))).toEqual(['series-1'])
  })

  it('単独の話のタイトルに一致する項目を返す', () => {
    expect(idsOf(filterLibraryEntries(entries, '読み切り', index))).toEqual(['standalone-1'])
  })

  it('一致しない場合は空にする', () => {
    expect(filterLibraryEntries(entries, '存在しない語', index)).toEqual([])
  })

  it('検索インデックスにない項目は除外する', () => {
    const extra = [...entries, seriesEntry('series-2', '未登録作品')]
    expect(idsOf(filterLibraryEntries(extra, '冒険', index))).toEqual(['series-1'])
  })
})
