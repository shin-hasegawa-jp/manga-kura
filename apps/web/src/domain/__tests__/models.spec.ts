import { describe, expect, it } from 'vitest'
import { validateAppSettings, validateComicImage, validateEpisode, validateSeries } from '../models'

const now = new Date('2026-07-17T00:00:00.000Z')

describe('domain model validation', () => {
  it('validates a series and rejects a missing required title', () => {
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

  it('validates an episode and rejects an invalid source URL', () => {
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

  it('validates an image and rejects missing binary data', () => {
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

  it('validates app settings and rejects a missing schema version', () => {
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
