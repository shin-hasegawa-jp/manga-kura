import { describe, expect, it } from 'vitest'
import type { Episode } from '@/domain/models'
import {
  getEpisodeReaderRoute,
  getReaderRouteTarget,
  isReaderRouteTargetValid,
} from '../readerRoute'

const seriesEpisode: Episode = {
  id: 'episode-1',
  seriesId: 'series-1',
  title: '第1話',
  sourcePageUrl: 'https://example.com/episode-1',
  scrollPosition: 0,
  scrollProgress: 0,
  createdAt: new Date('2026-07-20T00:00:00.000Z'),
  updatedAt: new Date('2026-07-20T00:00:00.000Z'),
}

describe('漫画閲覧ルート', () => {
  it('作品に属する話の名前付きルートを生成する', () => {
    expect(getEpisodeReaderRoute(seriesEpisode)).toEqual({
      name: 'seriesEpisodeReader',
      params: { seriesId: 'series-1', episodeId: 'episode-1' },
    })
  })

  it('単独の話の名前付きルートを生成する', () => {
    expect(getEpisodeReaderRoute({ ...seriesEpisode, seriesId: undefined })).toEqual({
      name: 'standaloneEpisodeReader',
      params: { episodeId: 'episode-1' },
    })
  })

  it('作品IDと話の所属が一致する場合だけ有効と判定する', () => {
    expect(
      isReaderRouteTargetValid(
        { kind: 'seriesEpisode', seriesId: 'series-1', episodeId: 'episode-1' },
        seriesEpisode,
      ),
    ).toBe(true)
    expect(
      isReaderRouteTargetValid(
        { kind: 'seriesEpisode', seriesId: 'other-series', episodeId: 'episode-1' },
        seriesEpisode,
      ),
    ).toBe(false)
    expect(
      isReaderRouteTargetValid(
        { kind: 'standaloneEpisode', episodeId: 'episode-1' },
        seriesEpisode,
      ),
    ).toBe(false)
  })

  it('名前付きルートとパラメータを閲覧対象として解釈する', () => {
    expect(getReaderRouteTarget('seriesEpisodeReader', 'series-1', 'episode-1')).toEqual({
      kind: 'seriesEpisode',
      seriesId: 'series-1',
      episodeId: 'episode-1',
    })
    expect(getReaderRouteTarget('standaloneEpisodeReader', undefined, ['episode-1'])).toEqual({
      kind: 'standaloneEpisode',
      episodeId: 'episode-1',
    })
  })

  it('ルート名または必須パラメータが不正な場合は閲覧対象を返さない', () => {
    expect(getReaderRouteTarget('seriesEpisodeReader', undefined, 'episode-1')).toBeUndefined()
    expect(getReaderRouteTarget('reader', undefined, 'episode-1')).toBeUndefined()
    expect(getReaderRouteTarget('standaloneEpisodeReader', undefined, undefined)).toBeUndefined()
  })
})
