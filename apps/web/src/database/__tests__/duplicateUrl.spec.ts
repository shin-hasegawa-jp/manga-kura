// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import type { Episode } from '@/domain/models'
import { DATABASE_NAME, MangaKuraDatabase } from '../database'
import { createDevelopmentComicFixture } from '../developmentComicFixture'
import { findDuplicateRegistrations, toDuplicateRegistrations } from '../duplicateUrl'
import { createMangaRepository } from '../repository'

const databases: MangaKuraDatabase[] = []

function createTestDatabase(): MangaKuraDatabase {
  const database = new MangaKuraDatabase(`${DATABASE_NAME}-test-${crypto.randomUUID()}`)
  databases.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.delete()))
})

function createEpisode(overrides: Pick<Episode, 'id' | 'title' | 'createdAt'>): Episode {
  return {
    sourcePageUrl: 'https://example.com/comic/1',
    updatedAt: overrides.createdAt,
    scrollPosition: 0,
    scrollProgress: 0,
    ...overrides,
  }
}

describe('重複登録の整理', () => {
  it('重複がなければ空配列を返す', () => {
    expect(toDuplicateRegistrations([])).toEqual([])
  })

  it('登録済みタイトルと登録日時を登録日時の新しい順で返す', () => {
    const older = createEpisode({
      id: 'older',
      title: '第1話',
      createdAt: new Date('2026-07-14T00:00:00.000Z'),
    })
    const newer = createEpisode({
      id: 'newer',
      title: '再保存した話',
      createdAt: new Date('2026-07-18T00:00:00.000Z'),
    })

    expect(toDuplicateRegistrations([older, newer])).toEqual([
      { episodeId: 'newer', title: '再保存した話', registeredAt: newer.createdAt },
      { episodeId: 'older', title: '第1話', registeredAt: older.createdAt },
    ])
  })
})

describe('重複URLの検出', () => {
  it('同一URLの既存話がなければ空配列を返す', async () => {
    const repository = createMangaRepository(createTestDatabase())
    const fixture = createDevelopmentComicFixture()

    await repository.episodes.save(fixture.episode)

    expect(
      await findDuplicateRegistrations(repository, 'https://example.com/not-registered'),
    ).toEqual([])
  })

  it('同一URLの既存話を登録済み情報として返す', async () => {
    const repository = createMangaRepository(createTestDatabase())
    const sourcePageUrl = 'https://example.com/comic/same'
    const first = createEpisode({
      id: 'dup-1',
      title: '最初の保存',
      createdAt: new Date('2026-07-14T00:00:00.000Z'),
    })
    const second = createEpisode({
      id: 'dup-2',
      title: '再保存',
      createdAt: new Date('2026-07-18T00:00:00.000Z'),
    })

    await repository.episodes.save({ ...first, sourcePageUrl })
    await repository.episodes.save({ ...second, sourcePageUrl })

    const duplicates = await findDuplicateRegistrations(repository, sourcePageUrl)

    expect(duplicates.map(({ episodeId }) => episodeId)).toEqual(['dup-2', 'dup-1'])
  })
})
