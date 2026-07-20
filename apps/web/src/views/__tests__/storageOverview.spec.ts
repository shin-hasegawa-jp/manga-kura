import { describe, expect, it } from 'vitest'
import type { StorageUsage } from '@/database/storageUsage'
import {
  buildStorageListItems,
  formatBytes,
  getEstimatedAvailableBytes,
  getStorageWarningStatus,
} from '../storageOverview'

describe('推定利用可能容量', () => {
  it('クォータと使用量から利用可能容量を求める', () => {
    expect(getEstimatedAvailableBytes({ usageBytes: 300, quotaBytes: 1000 })).toBe(700)
  })

  it('使用量が不明ならクォータ全体を利用可能とみなす', () => {
    expect(getEstimatedAvailableBytes({ quotaBytes: 1000 })).toBe(1000)
  })

  it('使用量がクォータを超える場合は0へ収める', () => {
    expect(getEstimatedAvailableBytes({ usageBytes: 1200, quotaBytes: 1000 })).toBe(0)
  })

  it('推定が取得できない場合は undefined を返す', () => {
    expect(getEstimatedAvailableBytes(undefined)).toBeUndefined()
    expect(getEstimatedAvailableBytes({ usageBytes: 300 })).toBeUndefined()
  })
})

describe('容量警告の判定', () => {
  it('使用容量が閾値以上のとき警告する', () => {
    expect(getStorageWarningStatus(1000, 900)).toBe('warning')
    expect(getStorageWarningStatus(900, 900)).toBe('warning')
  })

  it('使用容量が閾値未満のとき警告しない', () => {
    expect(getStorageWarningStatus(500, 900)).toBe('ok')
  })

  it('閾値が未設定（0以下）のとき警告しない', () => {
    expect(getStorageWarningStatus(1000, 0)).toBe('ok')
  })
})

describe('バイト数の整形', () => {
  it('単位を切り替えて読みやすく整える', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(842 * 1024 * 1024)).toBe('842 MB')
    expect(formatBytes(Math.round(5.1 * 1024 * 1024 * 1024))).toBe('5.1 GB')
  })
})

describe('ストレージ一覧の生成', () => {
  it('作品と単独の話を使用容量の多い順に並べ、作品には所属話の内訳を含める', () => {
    const usage: StorageUsage = {
      totalBytes: 650,
      imageCount: 4,
      seriesCount: 1,
      episodeCount: 3,
      series: [
        { seriesId: 'series-1', title: '冒険譚', episodeCount: 2, imageCount: 3, bytes: 600 },
      ],
      episodes: [
        { episodeId: 'ep-2', title: '第2話', seriesId: 'series-1', imageCount: 2, bytes: 500 },
        { episodeId: 'ep-1', title: '第1話', seriesId: 'series-1', imageCount: 1, bytes: 100 },
        { episodeId: 'standalone', title: '読み切り', imageCount: 1, bytes: 50 },
      ],
    }

    const items = buildStorageListItems(usage)

    expect(items.map(({ kind, id, bytes }) => ({ kind, id, bytes }))).toEqual([
      { kind: 'series', id: 'series-1', bytes: 600 },
      { kind: 'standalone', id: 'standalone', bytes: 50 },
    ])
    expect(items[0]?.episodes?.map(({ episodeId }) => episodeId)).toEqual(['ep-2', 'ep-1'])
    expect(items[1]?.episodes).toBeUndefined()
  })
})
