import {
  DEFAULT_LIBRARY_SORT_ORDER,
  LIBRARY_SORT_ORDERS,
  type AppSettings,
  type LibrarySortOrder,
} from '@/domain/models'
import type { MangaRepository } from './repository'

export const APP_SETTINGS_ID = 'app'

export function createDefaultAppSettings(): AppSettings {
  return {
    id: APP_SETTINGS_ID,
    sortOrder: DEFAULT_LIBRARY_SORT_ORDER,
    displaySettings: { theme: 'system' },
    schemaVersion: 1,
    offlineSettings: { enabled: false },
    storageSettings: { warningThresholdBytes: 0 },
  }
}

function isLibrarySortOrder(value: unknown): value is LibrarySortOrder {
  return LIBRARY_SORT_ORDERS.includes(value as LibrarySortOrder)
}

/**
 * 保存済みの並び順を読み込む。未保存または不正な値の場合はデフォルトを返す。
 */
export async function loadLibrarySortOrder(repository: MangaRepository): Promise<LibrarySortOrder> {
  const settings = await repository.settings.findById(APP_SETTINGS_ID)

  return settings && isLibrarySortOrder(settings.sortOrder)
    ? settings.sortOrder
    : DEFAULT_LIBRARY_SORT_ORDER
}

/**
 * 並び順を保存する。既存のアプリ設定があれば他の項目を保ったまま並び順だけ更新する。
 */
export async function saveLibrarySortOrder(
  repository: MangaRepository,
  order: LibrarySortOrder,
): Promise<void> {
  const existing = await repository.settings.findById(APP_SETTINGS_ID)
  const settings: AppSettings = {
    ...(existing ?? createDefaultAppSettings()),
    sortOrder: order,
  }
  await repository.settings.save(settings)
}
