import { describe, expect, it } from 'vitest'
import type { ComicImage, Episode, Series } from '@/domain/models'
import { computeStorageUsage } from '../storageUsage'

const baseDate = new Date('2026-07-01T00:00:00.000Z')

function createSeries(id: string, title: string): Series {
  return { id, title, createdAt: baseDate, updatedAt: baseDate, episodeCount: 0 }
}

function createEpisode(id: string, title: string, seriesId?: string): Episode {
  return {
    id,
    title,
    ...(seriesId ? { seriesId } : {}),
    sourcePageUrl: `https://example.com/${id}`,
    createdAt: baseDate,
    updatedAt: baseDate,
    scrollPosition: 0,
    scrollProgress: 0,
  }
}

function createImage(id: string, episodeId: string, fileSize: number): ComicImage {
  return {
    id,
    episodeId,
    displayOrder: 0,
    blob: new Blob(['x'], { type: 'image/png' }),
    sourceUrl: `https://example.com/${id}.png`,
    mimeType: 'image/png',
    fileSize,
    width: 100,
    height: 100,
    createdAt: baseDate,
  }
}

describe('使用容量の集計', () => {
  it('データがない場合はすべて0になる', () => {
    expect(computeStorageUsage([], [], [])).toEqual({
      totalBytes: 0,
      imageCount: 0,
      seriesCount: 0,
      episodeCount: 0,
      series: [],
      episodes: [],
    })
  })

  it('単独の話だけでも全体と話ごとの容量を集計する', () => {
    const episode = createEpisode('standalone', '読み切り')
    const images = [
      createImage('img-1', 'standalone', 300),
      createImage('img-2', 'standalone', 200),
    ]

    const usage = computeStorageUsage([], [episode], images)

    expect(usage).toEqual({
      totalBytes: 500,
      imageCount: 2,
      seriesCount: 0,
      episodeCount: 1,
      series: [],
      episodes: [{ episodeId: 'standalone', title: '読み切り', imageCount: 2, bytes: 500 }],
    })
  })

  it('作品と単独の話が混在しても作品ごと・話ごとに集計する', () => {
    const series = createSeries('series-1', '冒険譚')
    const episode1 = createEpisode('ep-1', '第1話', 'series-1')
    const episode2 = createEpisode('ep-2', '第2話', 'series-1')
    const standalone = createEpisode('standalone', '読み切り')
    const images = [
      createImage('img-1', 'ep-1', 100),
      createImage('img-2', 'ep-2', 400),
      createImage('img-3', 'ep-2', 100),
      createImage('img-4', 'standalone', 50),
    ]

    const usage = computeStorageUsage([series], [episode1, episode2, standalone], images)

    expect(usage.totalBytes).toBe(650)
    expect(usage.imageCount).toBe(4)
    expect(usage.seriesCount).toBe(1)
    expect(usage.episodeCount).toBe(3)
    expect(usage.series).toEqual([
      { seriesId: 'series-1', title: '冒険譚', episodeCount: 2, imageCount: 3, bytes: 600 },
    ])
    // 使用容量の多い順（ep-2=500, ep-1=100, standalone=50）
    expect(usage.episodes.map(({ episodeId, bytes }) => ({ episodeId, bytes }))).toEqual([
      { episodeId: 'ep-2', bytes: 500 },
      { episodeId: 'ep-1', bytes: 100 },
      { episodeId: 'standalone', bytes: 50 },
    ])
  })

  it('画像がない話や作品も0バイトとして数える', () => {
    const series = createSeries('empty-series', '未着手作品')
    const episode = createEpisode('empty-ep', '画像なしの話')

    const usage = computeStorageUsage([series], [episode], [])

    expect(usage.series[0]).toEqual({
      seriesId: 'empty-series',
      title: '未着手作品',
      episodeCount: 0,
      imageCount: 0,
      bytes: 0,
    })
    expect(usage.episodes[0]).toEqual({
      episodeId: 'empty-ep',
      title: '画像なしの話',
      imageCount: 0,
      bytes: 0,
    })
  })
})
