import type { ComicImage, Episode, Series } from '@/domain/models'

export interface EpisodeStorageUsage {
  episodeId: string
  title: string
  seriesId?: string
  imageCount: number
  bytes: number
}

export interface SeriesStorageUsage {
  seriesId: string
  title: string
  episodeCount: number
  imageCount: number
  bytes: number
}

export interface StorageUsage {
  totalBytes: number
  imageCount: number
  seriesCount: number
  episodeCount: number
  series: SeriesStorageUsage[]
  episodes: EpisodeStorageUsage[]
}

interface ImageStats {
  count: number
  bytes: number
}

// 使用容量の多い順に並べ、同値はIDで安定させる
function byBytesDescThenId<T extends { bytes: number }>(getId: (item: T) => string) {
  return (left: T, right: T): number => {
    if (right.bytes !== left.bytes) return right.bytes - left.bytes
    return getId(left).localeCompare(getId(right))
  }
}

/**
 * 保存済みデータから、アプリ全体・作品ごと・話ごとの使用容量を集計する。
 * 使用容量は画像のファイルサイズ合計とし、保存画像枚数・作品数・話数も数える。
 */
export function computeStorageUsage(
  series: readonly Series[],
  episodes: readonly Episode[],
  images: readonly ComicImage[],
): StorageUsage {
  const statsByEpisodeId = new Map<string, ImageStats>()
  let totalBytes = 0

  for (const image of images) {
    totalBytes += image.fileSize
    const stats = statsByEpisodeId.get(image.episodeId) ?? { count: 0, bytes: 0 }
    stats.count += 1
    stats.bytes += image.fileSize
    statsByEpisodeId.set(image.episodeId, stats)
  }

  const episodeUsages = episodes.map((episode): EpisodeStorageUsage => {
    const stats = statsByEpisodeId.get(episode.id) ?? { count: 0, bytes: 0 }

    return {
      episodeId: episode.id,
      title: episode.title,
      ...(episode.seriesId ? { seriesId: episode.seriesId } : {}),
      imageCount: stats.count,
      bytes: stats.bytes,
    }
  })

  const usageByEpisodeId = new Map(episodeUsages.map((usage) => [usage.episodeId, usage]))
  const seriesUsages = series.map((item): SeriesStorageUsage => {
    const memberEpisodes = episodes.filter((episode) => episode.seriesId === item.id)
    let bytes = 0
    let imageCount = 0

    for (const episode of memberEpisodes) {
      const usage = usageByEpisodeId.get(episode.id)
      if (usage) {
        bytes += usage.bytes
        imageCount += usage.imageCount
      }
    }

    return {
      seriesId: item.id,
      title: item.title,
      episodeCount: memberEpisodes.length,
      imageCount,
      bytes,
    }
  })

  return {
    totalBytes,
    imageCount: images.length,
    seriesCount: series.length,
    episodeCount: episodes.length,
    series: seriesUsages.sort(byBytesDescThenId((usage) => usage.seriesId)),
    episodes: episodeUsages.sort(byBytesDescThenId((usage) => usage.episodeId)),
  }
}
