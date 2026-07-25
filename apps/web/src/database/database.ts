import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { AppSettings, ComicImage, Episode, Series } from '@/domain/models'

export const DATABASE_NAME = 'manga-kura'
export const DATABASE_VERSION = 2

export const DATABASE_STORES = {
  series: '&id, title, createdAt, updatedAt, lastReadAt',
  episodes: '&id, seriesId, title, sourcePageUrl, createdAt, updatedAt, lastReadAt',
  images: '&id, episodeId, [episodeId+displayOrder], createdAt',
  settings: '&id',
}

export class MangaKuraDatabase extends Dexie {
  series: Table<Series, string>
  episodes: Table<Episode, string>
  images: Table<ComicImage, string>
  settings: Table<AppSettings, string>

  constructor(name = DATABASE_NAME) {
    super(name)
    this.version(1).stores(DATABASE_STORES)
    this.version(DATABASE_VERSION).stores(DATABASE_STORES)
    this.series = this.table<Series, string>('series')
    this.episodes = this.table<Episode, string>('episodes')
    this.images = this.table<ComicImage, string>('images')
    this.settings = this.table<AppSettings, string>('settings')
  }
}

export const database = new MangaKuraDatabase()
