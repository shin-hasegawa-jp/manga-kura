import { describe, expect, it } from 'vitest'
import { validateAppSettings, validateComicImage, validateEpisode, validateSeries } from '../models'

const now = new Date('2026-07-17T00:00:00.000Z')

describe('ドメインモデルのバリデーション', () => {
  it('作品を検証し、必須のタイトルがないデータを拒否する', () => {
    const series = {
      id: 'series-1',
      title: '作品1',
      createdAt: now,
      updatedAt: now,
      episodeCount: 0,
    }

    expect(validateSeries(series)).toEqual(series)
    expect(() => validateSeries({ ...series, title: undefined })).toThrow()
  })

  it('話を検証し、不正な元ページURLを拒否する', () => {
    const episode = {
      id: 'episode-1',
      title: '第1話',
      sourcePageUrl: 'https://example.com/episodes/1',
      createdAt: now,
      updatedAt: now,
      scrollPosition: 0,
      scrollProgress: 0,
    }

    expect(validateEpisode(episode)).toEqual(episode)
    expect(() => validateEpisode({ ...episode, sourcePageUrl: 'not-a-url' })).toThrow()
  })

  it('話へ任意の保存時コンテンツ高さを保持し、負の値を拒否する', () => {
    const episode = {
      id: 'episode-1',
      title: '第1話',
      sourcePageUrl: 'https://example.com/episodes/1',
      createdAt: now,
      updatedAt: now,
      scrollPosition: 1200,
      scrollProgress: 0.5,
      savedContentHeight: 2400,
    }

    expect(validateEpisode(episode)).toEqual(episode)
    expect(validateEpisode({ ...episode, savedContentHeight: undefined }).savedContentHeight).toBe(
      undefined,
    )
    expect(() => validateEpisode({ ...episode, savedContentHeight: -1 })).toThrow()
  })

  it('画像を検証し、バイナリデータがない場合を拒否する', () => {
    const image = {
      id: 'image-1',
      episodeId: 'episode-1',
      displayOrder: 0,
      blob: new Blob(['image'], { type: 'image/png' }),
      sourceUrl: 'https://example.com/images/1.png',
      mimeType: 'image/png',
      fileSize: 5,
      width: 100,
      height: 200,
      createdAt: now,
    }

    expect(validateComicImage(image)).toEqual(image)
    expect(() => validateComicImage({ ...image, blob: undefined })).toThrow()
  })

  it('アプリ設定を検証し、スキーマバージョンがない場合を拒否する', () => {
    const settings = {
      id: 'app',
      sortOrder: 'recentlyAdded',
      displaySettings: { theme: 'system' },
      schemaVersion: 1,
      offlineSettings: { enabled: false },
      storageSettings: { warningThresholdBytes: 0 },
    }

    expect(validateAppSettings(settings)).toEqual(settings)
    expect(() => validateAppSettings({ ...settings, schemaVersion: undefined })).toThrow()
  })
})
