import type { MangaKuraDatabase } from './database'

export interface DeletionService {
  deleteEpisode(episodeId: string): Promise<void>
  deleteSeries(seriesId: string): Promise<void>
  deleteImage(imageId: string): Promise<void>
  deleteAllData(): Promise<void>
}

export function createDeletionService(database: MangaKuraDatabase): DeletionService {
  async function deleteEpisodeImages(episodeId: string): Promise<void> {
    await database.images.where('episodeId').equals(episodeId).delete()
  }

  return {
    async deleteEpisode(episodeId) {
      await database.transaction(
        'rw',
        database.series,
        database.episodes,
        database.images,
        async () => {
          const episode = await database.episodes.get(episodeId)
          if (episode === undefined) return

          await deleteEpisodeImages(episodeId)
          await database.episodes.delete(episodeId)

          // 所属作品の話数を残りの話数へ整合させる（空になっても作品は残す）
          if (episode.seriesId !== undefined) {
            const series = await database.series.get(episode.seriesId)
            if (series !== undefined) {
              const remaining = await database.episodes
                .where('seriesId')
                .equals(episode.seriesId)
                .count()
              await database.series.put({ ...series, episodeCount: remaining })
            }
          }
        },
      )
    },

    async deleteSeries(seriesId) {
      await database.transaction(
        'rw',
        database.series,
        database.episodes,
        database.images,
        async () => {
          const series = await database.series.get(seriesId)
          if (series === undefined) return

          const memberEpisodeIds = await database.episodes
            .where('seriesId')
            .equals(seriesId)
            .primaryKeys()

          for (const episodeId of memberEpisodeIds) {
            await deleteEpisodeImages(episodeId)
          }
          await database.episodes.where('seriesId').equals(seriesId).delete()
          await database.series.delete(seriesId)
        },
      )
    },

    async deleteImage(imageId) {
      await database.images.delete(imageId)
    },

    async deleteAllData() {
      await database.transaction(
        'rw',
        database.series,
        database.episodes,
        database.images,
        async () => {
          await database.images.clear()
          await database.episodes.clear()
          await database.series.clear()
        },
      )
    },
  }
}
