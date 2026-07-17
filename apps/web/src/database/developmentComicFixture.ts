import type { ComicImage, Episode, Series } from '@/domain/models'

const developmentImageBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0xf0,
  0x1f, 0x00, 0x05, 0x00, 0x01, 0xff, 0x89, 0x99, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

export interface DevelopmentComicFixture {
  series: Series
  episode: Episode
  image: ComicImage
}

export function createDevelopmentComicFixture(): DevelopmentComicFixture {
  const now = new Date('2026-07-17T00:00:00.000Z')

  return {
    series: {
      id: 'development-series-1',
      title: '開発用作品',
      createdAt: now,
      updatedAt: now,
      episodeCount: 1,
    },
    episode: {
      id: 'development-episode-1',
      seriesId: 'development-series-1',
      title: '第1話',
      episodeNumber: 1,
      sourcePageUrl: 'https://example.com/development-series/episodes/1',
      createdAt: now,
      updatedAt: now,
      scrollPosition: 0,
      scrollProgress: 0,
    },
    image: {
      id: 'development-image-1',
      episodeId: 'development-episode-1',
      displayOrder: 0,
      blob: new Blob([developmentImageBytes], { type: 'image/png' }),
      sourceUrl: 'https://example.com/development-series/episodes/1/images/1.png',
      mimeType: 'image/png',
      fileSize: developmentImageBytes.byteLength,
      width: 1,
      height: 1,
      createdAt: now,
    },
  }
}
