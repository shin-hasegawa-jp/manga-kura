import { describe, expect, it, vi } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import type { TopLevelLibraryEntry } from '@/database/repository'
import { createLibraryListItemPresenter } from '../libraryListItemPresenter'

describe('ライブラリ一覧項目のサムネイル表示', () => {
  it('サムネイルだけをObject URLへ変換し、画像がない項目にはURLを設定しない', () => {
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
      {
        kind: 'series',
        series: fixture.series,
        episodeCount: 1,
        thumbnailImage: fixture.image,
      },
      { kind: 'standaloneEpisode', episode: standaloneEpisode },
    ])

    expect(objectUrls.create).toHaveBeenCalledTimes(1)
    expect(objectUrls.create).toHaveBeenCalledWith(fixture.image.blob)
    expect(items).toEqual([
      {
        itemId: fixture.series.id,
        title: fixture.series.title,
        kind: 'series',
        kindLabel: '作品',
        detailLabel: '全1話',
        thumbnailUrl: 'blob:thumbnail',
      },
      {
        itemId: standaloneEpisode.id,
        title: standaloneEpisode.title,
        kind: 'standaloneEpisode',
        kindLabel: '単独の話',
        detailLabel: '第1話',
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
    const entries: TopLevelLibraryEntry[] = [
      {
        kind: 'series',
        series: fixture.series,
        episodeCount: 1,
        thumbnailImage: fixture.image,
      },
    ]

    presenter.present(entries)
    presenter.present(entries)
    presenter.dispose()

    expect(objectUrls.revokeAll).toHaveBeenCalledTimes(3)
  })
})
