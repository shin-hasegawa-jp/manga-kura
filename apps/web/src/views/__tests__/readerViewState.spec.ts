import { describe, expect, it } from 'vitest'
import type { ComicImage, Episode, Series } from '@/domain/models'
import { getReaderBackRoute, getReaderViewState } from '../readerViewState'

const episode: Episode = {
  id: 'episode-1',
  seriesId: 'series-1',
  title: '第1話',
  sourcePageUrl: 'https://example.com/1',
  createdAt: new Date('2026-07-19T00:00:00.000Z'),
  updatedAt: new Date('2026-07-19T00:00:00.000Z'),
  scrollPosition: 0,
  scrollProgress: 0,
}
const series: Series = {
  id: 'series-1',
  title: '作品',
  createdAt: new Date('2026-07-19T00:00:00.000Z'),
  updatedAt: new Date('2026-07-19T00:00:00.000Z'),
  episodeCount: 1,
}
const image: ComicImage = {
  id: 'image-1',
  episodeId: episode.id,
  displayOrder: 0,
  blob: new Blob(['image'], { type: 'image/png' }),
  sourceUrl: 'https://example.com/1.png',
  mimeType: 'image/png',
  fileSize: 5,
  width: 100,
  height: 200,
  createdAt: new Date('2026-07-19T00:00:00.000Z'),
}

describe('漫画閲覧画面の状態', () => {
  it('読込中・Not Found・画像なし・閲覧可能を区別する', () => {
    expect(getReaderViewState(true, undefined, undefined, [])).toEqual({ kind: 'loading' })
    expect(getReaderViewState(false, undefined, undefined, [])).toEqual({ kind: 'notFound' })
    expect(getReaderViewState(false, episode, series, [])).toEqual({
      kind: 'empty',
      episode,
      series,
    })
    expect(getReaderViewState(false, episode, series, [image])).toEqual({
      kind: 'ready',
      episode,
      series,
      images: [image],
    })
  })

  it('作品の話は作品詳細、単独の話は本棚を戻り先にする', () => {
    expect(getReaderBackRoute(episode)).toEqual({
      name: 'seriesDetail',
      params: { seriesId: 'series-1' },
    })
    expect(getReaderBackRoute({ ...episode, seriesId: undefined })).toEqual({ name: 'library' })
  })
})
