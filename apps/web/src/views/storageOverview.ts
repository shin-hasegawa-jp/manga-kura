import type { StorageUsage } from '@/database/storageUsage'

export interface StorageEstimate {
  usageBytes?: number
  quotaBytes?: number
}

export type StorageWarningStatus = 'ok' | 'warning'

export interface StorageEpisodeListItem {
  episodeId: string
  title: string
  imageCount: number
  bytes: number
}

export interface StorageListItem {
  kind: 'series' | 'standalone'
  id: string
  title: string
  imageCount: number
  bytes: number
  episodeCount?: number
  episodes?: StorageEpisodeListItem[]
}

/**
 * バイト数を MB・GB などの読みやすい単位へ整える。
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unitIndex]}`
}

/**
 * 使用容量の集計から、ストレージ管理画面のトップ一覧（作品・単独の話）を
 * 使用容量の多い順に作る。作品には所属話ごとの内訳も含める。
 */
export function buildStorageListItems(usage: StorageUsage): StorageListItem[] {
  const seriesItems: StorageListItem[] = usage.series.map((series) => ({
    kind: 'series',
    id: series.seriesId,
    title: series.title,
    imageCount: series.imageCount,
    bytes: series.bytes,
    episodeCount: series.episodeCount,
    episodes: usage.episodes
      .filter((episode) => episode.seriesId === series.seriesId)
      .map((episode) => ({
        episodeId: episode.episodeId,
        title: episode.title,
        imageCount: episode.imageCount,
        bytes: episode.bytes,
      })),
  }))
  const standaloneItems: StorageListItem[] = usage.episodes
    .filter((episode) => episode.seriesId === undefined)
    .map((episode) => ({
      kind: 'standalone',
      id: episode.episodeId,
      title: episode.title,
      imageCount: episode.imageCount,
      bytes: episode.bytes,
    }))

  return [...seriesItems, ...standaloneItems].sort((left, right) => {
    if (right.bytes !== left.bytes) return right.bytes - left.bytes
    return left.id.localeCompare(right.id)
  })
}

/**
 * 推定利用可能容量（クォータ − 使用量）を求める。クォータが取得できない場合は
 * undefined を返し、フォールバック表示に使う。
 */
export function getEstimatedAvailableBytes(
  estimate: StorageEstimate | undefined,
): number | undefined {
  if (!estimate || estimate.quotaBytes === undefined) return undefined

  return Math.max(0, estimate.quotaBytes - (estimate.usageBytes ?? 0))
}

/**
 * アプリ設定の警告閾値と使用容量から、容量警告の状態を判定する。
 * 閾値が未設定（0以下）の場合は警告しない。
 */
export function getStorageWarningStatus(
  usedBytes: number,
  thresholdBytes: number,
): StorageWarningStatus {
  return thresholdBytes > 0 && usedBytes >= thresholdBytes ? 'warning' : 'ok'
}

/**
 * ブラウザの Storage Manager API から推定使用量・クォータを読み取る。
 * API が使えない環境では undefined を返す。
 */
export async function readStorageEstimate(): Promise<StorageEstimate | undefined> {
  if (typeof navigator === 'undefined' || typeof navigator.storage?.estimate !== 'function') {
    return undefined
  }

  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usageBytes: usage, quotaBytes: quota }
  } catch {
    return undefined
  }
}
