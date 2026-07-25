import { describe, expect, it } from 'vitest'
import {
  createImageContentHash,
  getImageDuplicateReasons,
  normalizeImageSourceUrl,
} from '../imageFingerprint'

describe('画像フィンガープリント', () => {
  it('Web Crypto APIで画像内容のSHA-256を生成する', async () => {
    await expect(createImageContentHash(new Blob(['abc']))).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('URLのホスト・既定ポート・フラグメントを正規化する', () => {
    expect(normalizeImageSourceUrl('https://EXAMPLE.com:443/a.png#preview')).toBe(
      'https://example.com/a.png',
    )
  })

  it('同一内容と同一URLを別の根拠として返す', () => {
    expect(
      getImageDuplicateReasons(
        { sourceUrl: 'https://example.com/a.png#one', contentHash: 'a'.repeat(64) },
        { sourceUrl: 'https://example.com/a.png#two', contentHash: 'a'.repeat(64) },
      ),
    ).toEqual(['same-url', 'same-content'])
  })

  it('同一URLでも内容が異なる場合はURL一致だけを返す', () => {
    expect(
      getImageDuplicateReasons(
        { sourceUrl: 'https://example.com/a.png', contentHash: 'a'.repeat(64) },
        { sourceUrl: 'https://example.com/a.png', contentHash: 'b'.repeat(64) },
      ),
    ).toEqual(['same-url'])
  })

  it('既存ハッシュがない異なるURLは重複としない', () => {
    expect(
      getImageDuplicateReasons(
        { sourceUrl: 'https://example.com/a.png', contentHash: 'a'.repeat(64) },
        { sourceUrl: 'https://example.com/b.png' },
      ),
    ).toEqual([])
  })
})
