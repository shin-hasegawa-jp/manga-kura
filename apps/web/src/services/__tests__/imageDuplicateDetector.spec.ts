import { describe, expect, it, vi } from 'vitest'
import type { ComicImage, Episode } from '@/domain/models'
import type { RegistrationImageSource } from '@/database/registrationService'
import { detectImageDuplicates } from '../imageDuplicateDetector'

const episode: Episode = {
  id: 'episode-1',
  title: '第1話',
  sourcePageUrl: 'https://example.com/episode-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  scrollPosition: 0,
  scrollProgress: 0,
}

function image(sourceUrl: string, content: string): RegistrationImageSource {
  const blob = new Blob([content], { type: 'image/png' })
  return { blob, sourceUrl, mimeType: 'image/png', fileSize: blob.size, width: 100, height: 200 }
}

function savedImage(id: string, sourceUrl: string, content: string): ComicImage {
  return {
    ...image(sourceUrl, content),
    id,
    episodeId: episode.id,
    displayOrder: 1,
    createdAt: new Date(),
  }
}

describe('重複画像検出', () => {
  it('同一バッチ内の内容重複を検出する', async () => {
    const result = await detectImageDuplicates(
      [image('https://example.com/a.png', 'same'), image('https://cdn.example.com/b.png', 'same')],
      { async *savedImages() {} },
    )

    expect(result.matches).toEqual([
      expect.objectContaining({
        incomingIndex: 1,
        reasons: ['same-content'],
        target: { kind: 'batch', imageIndex: 0 },
      }),
    ])
  })

  it('保存済み画像の作品・話・位置を返し、既存ハッシュを段階的に保存する', async () => {
    const existing = savedImage('saved-1', 'https://cdn.example.com/old.png', 'same')
    const saveComputedHash = vi.fn()
    const result = await detectImageDuplicates([image('https://example.com/new.png', 'same')], {
      async *savedImages() {
        yield { image: existing, episode, series: undefined }
      },
      saveComputedHash,
    })

    expect(result.matches[0]).toEqual({
      incomingIndex: 0,
      reasons: ['same-content'],
      target: {
        kind: 'saved',
        imageId: 'saved-1',
        imagePosition: 2,
        episodeId: 'episode-1',
        episodeTitle: '第1話',
      },
    })
    expect(saveComputedHash).toHaveBeenCalledOnce()
  })

  it('重複なしでは空配列を返す', async () => {
    const result = await detectImageDuplicates([image('https://example.com/a.png', 'new')], {
      async *savedImages() {
        yield {
          image: savedImage('saved-1', 'https://example.com/b.png', 'old'),
          episode,
        }
      },
    })
    expect(result.matches).toEqual([])
  })

  it('複数の重複をすべて返す', async () => {
    const result = await detectImageDuplicates(
      [image('https://example.com/a.png', 'same'), image('https://example.com/a.png', 'same')],
      {
        async *savedImages() {
          yield { image: savedImage('saved-1', 'https://example.com/a.png', 'same'), episode }
        },
      },
    )
    expect(result.matches).toHaveLength(3)
  })
})
