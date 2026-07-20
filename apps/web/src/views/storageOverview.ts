export interface StorageEstimate {
  usageBytes?: number
  quotaBytes?: number
}

export type StorageWarningStatus = 'ok' | 'warning'

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
