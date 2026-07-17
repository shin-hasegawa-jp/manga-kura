import { describe, expect, it, vi } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { createLibraryListItemPresenter } from '../libraryListItemPresenter'

describe('ライブラリ一覧項目のサムネイル表示', () => {
  it('先頭画像だけをObject URLへ変換し、画像がない話にはURLを設定しない', () => {
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '単独の話',
    }
    const objectUrls = {
      create: vi.fn().mockReturnValue('blob:thumbnail'),
      revokeAll: vi.fn(),
    }
    const presenter = createLibraryListItemPresenter(objectUrls)

    const items = presenter.present([
      { episode: fixture.episode, series: fixture.series, thumbnailImage: fixture.image },
      { episode: standaloneEpisode },
    ])

    expect(objectUrls.create).toHaveBeenCalledTimes(1)
    expect(objectUrls.create).toHaveBeenCalledWith(fixture.image.blob)
    expect(items).toEqual([
      {
        episodeId: fixture.episode.id,
        episodeTitle: fixture.episode.title,
        contextLabel: fixture.series.title,
        kind: 'series',
        thumbnailUrl: 'blob:thumbnail',
      },
      {
        episodeId: standaloneEpisode.id,
        episodeTitle: standaloneEpisode.title,
        contextLabel: '単独の話',
        kind: 'standalone',
        thumbnailUrl: undefined,
      },
    ])
  })

  it('一覧の再生成時と破棄時に既存のObject URLを解放する', () => {
    const fixture = createDevelopmentComicFixture()
    const objectUrls = {
      create: vi.fn().mockReturnValue('blob:thumbnail'),
      revokeAll: vi.fn(),
    }
    const presenter = createLibraryListItemPresenter(objectUrls)
    const entries = [
      { episode: fixture.episode, series: fixture.series, thumbnailImage: fixture.image },
    ]

    presenter.present(entries)
    presenter.present(entries)
    presenter.dispose()

    expect(objectUrls.revokeAll).toHaveBeenCalledTimes(3)
  })
})
