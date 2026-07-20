import { describe, expect, it } from 'vitest'
import { getEstimatedAvailableBytes, getStorageWarningStatus } from '../storageOverview'

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
