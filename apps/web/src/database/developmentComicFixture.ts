import type { Episode, Series } from '@/domain/models'

export interface DevelopmentComicFixture {
  series: Series
  episode: Episode
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
  }
}
