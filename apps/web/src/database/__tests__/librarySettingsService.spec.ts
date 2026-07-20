// @vitest-environment node

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { validateAppSettings } from '@/domain/models'
import { DATABASE_NAME, MangaKuraDatabase } from '../database'
import {
  APP_SETTINGS_ID,
  createDefaultAppSettings,
  loadLibrarySortOrder,
  saveLibrarySortOrder,
} from '../librarySettingsService'
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

describe('並び順設定の永続化', () => {
  it('既定のアプリ設定は検証を通過する', () => {
    expect(validateAppSettings(createDefaultAppSettings())).toEqual(createDefaultAppSettings())
  })

  it('未保存の場合はデフォルトの並び順を返す', async () => {
    const repository = createMangaRepository(createTestDatabase())

    expect(await loadLibrarySortOrder(repository)).toBe('recentlyRead')
  })

  it('保存した並び順を読み込める', async () => {
    const repository = createMangaRepository(createTestDatabase())

    await saveLibrarySortOrder(repository, 'title')

    expect(await loadLibrarySortOrder(repository)).toBe('title')
  })

  it('並び順を更新しても他のアプリ設定を保つ', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)

    await repository.settings.save({
      ...createDefaultAppSettings(),
      sortOrder: 'recentlyAdded',
      displaySettings: { theme: 'dark' },
      storageSettings: { warningThresholdBytes: 4831838208 },
    })
    await saveLibrarySortOrder(repository, 'recentlyUpdated')

    const settings = await repository.settings.findById(APP_SETTINGS_ID)
    expect(settings?.sortOrder).toBe('recentlyUpdated')
    expect(settings?.displaySettings).toEqual({ theme: 'dark' })
    expect(settings?.storageSettings).toEqual({ warningThresholdBytes: 4831838208 })
  })

  it('保存済みの並び順が不正な場合はデフォルトへフォールバックする', async () => {
    const database = createTestDatabase()
    const repository = createMangaRepository(database)

    // 検証を介さずに不正な値を直接保存する
    await database.settings.put({
      ...createDefaultAppSettings(),
      sortOrder: 'unknown-order',
    } as never)

    expect(await loadLibrarySortOrder(repository)).toBe('recentlyRead')
  })
})
