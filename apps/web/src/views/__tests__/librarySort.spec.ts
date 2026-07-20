import { describe, expect, it } from 'vitest'
import type { Episode, Series } from '@/domain/models'
import type { TopLevelLibraryEntry } from '@/database/repository'
import { sortLibraryEntries } from '../librarySort'

function createSeriesEntry(
  overrides: Partial<Series> & Pick<Series, 'id' | 'title'>,
): TopLevelLibraryEntry {
  return {
    kind: 'series',
    series: {
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      episodeCount: 1,
      ...overrides,
    },
    episodeCount: 1,
  }
}

function createStandaloneEntry(
  overrides: Partial<Episode> & Pick<Episode, 'id' | 'title'>,
): TopLevelLibraryEntry {
  return {
    kind: 'standaloneEpisode',
    episode: {
      sourcePageUrl: 'https://example.com/standalone',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      scrollPosition: 0,
      scrollProgress: 0,
      ...overrides,
    },
  }
}

function idsOf(entries: readonly TopLevelLibraryEntry[]): string[] {
  return entries.map((entry) => (entry.kind === 'series' ? entry.series.id : entry.episode.id))
}

describe('トップ一覧の並べ替え', () => {
  const read = createSeriesEntry({
    id: 'read',
    title: 'い',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-05T00:00:00.000Z'),
    lastReadAt: new Date('2026-07-10T00:00:00.000Z'),
  })
  const unreadRecent = createStandaloneEntry({
    id: 'unread-recent',
    title: 'あ',
    createdAt: new Date('2026-07-15T00:00:00.000Z'),
    updatedAt: new Date('2026-07-15T00:00:00.000Z'),
  })
  const unreadOld = createStandaloneEntry({
    id: 'unread-old',
    title: 'う',
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  })
  const entries = [read, unreadOld, unreadRecent]

  it('最近読んだ順は最終閲覧日時を基準にし、未閲覧の項目は追加日時で並べる', () => {
    // 未閲覧項目は追加日時をキーにするため、7/15追加の未閲覧が7/10閲覧より前へ来る
    expect(idsOf(sortLibraryEntries(entries, 'recentlyRead'))).toEqual([
      'unread-recent',
      'read',
      'unread-old',
    ])
  })

  it('最近追加した順は追加日時の新しい順で並べる', () => {
    expect(idsOf(sortLibraryEntries(entries, 'recentlyAdded'))).toEqual([
      'unread-recent',
      'unread-old',
      'read',
    ])
  })

  it('更新日時順は更新日時の新しい順で並べる', () => {
    expect(idsOf(sortLibraryEntries(entries, 'recentlyUpdated'))).toEqual([
      'unread-old',
      'unread-recent',
      'read',
    ])
  })

  it('タイトル順は日本語のタイトル昇順で並べる', () => {
    expect(idsOf(sortLibraryEntries(entries, 'title'))).toEqual([
      'unread-recent',
      'read',
      'unread-old',
    ])
  })

  it('同値の場合はタイトル・IDで安定した順序にし、入力を変更しない', () => {
    const sameTime = new Date('2026-07-03T00:00:00.000Z')
    const a = createSeriesEntry({ id: 'b-id', title: '同じ', createdAt: sameTime })
    const b = createSeriesEntry({ id: 'a-id', title: '同じ', createdAt: sameTime })
    const input = [a, b]

    expect(idsOf(sortLibraryEntries(input, 'recentlyAdded'))).toEqual(['a-id', 'b-id'])
    expect(idsOf(input)).toEqual(['b-id', 'a-id'])
  })
})
