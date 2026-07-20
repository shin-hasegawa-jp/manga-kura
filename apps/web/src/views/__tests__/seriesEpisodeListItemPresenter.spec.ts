import { describe, expect, it, vi } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { createSeriesEpisodeListItemPresenter } from '../seriesEpisodeListItemPresenter'

describe('作品内の話カード表示', () => {
  it('話タイトル・任意の話数・先頭画像を表示用データへ変換する', () => {
    const fixture = createDevelopmentComicFixture()
    const unnumberedEpisode = {
      ...fixture.episode,
      id: 'unnumbered-episode',
      episodeNumber: undefined,
      title: '番外編',
    }
    const objectUrls = {
      create: vi.fn().mockReturnValue('blob:episode-thumbnail'),
      revokeAll: vi.fn(),
    }
    const presenter = createSeriesEpisodeListItemPresenter(objectUrls)

    expect(
      presenter.present([
        { episode: fixture.episode, thumbnailImage: fixture.image },
        { episode: unnumberedEpisode },
      ]),
    ).toEqual([
      {
        episodeId: fixture.episode.id,
        title: fixture.episode.title,
        episodeNumberLabel: '第1話',
        thumbnailUrl: 'blob:episode-thumbnail',
      },
      { episodeId: unnumberedEpisode.id, title: unnumberedEpisode.title },
    ])
    expect(objectUrls.create).toHaveBeenCalledWith(fixture.image.blob)
  })

  it('閲覧途中の話には続きから読む進捗を付与し、未閲覧の話には付与しない', () => {
    const fixture = createDevelopmentComicFixture()
    const inProgressEpisode = {
      ...fixture.episode,
      id: 'in-progress-episode',
      scrollProgress: 0.4,
      lastReadAt: new Date('2026-07-20T05:00:00.000Z'),
    }
    const objectUrls = {
      create: vi.fn().mockReturnValue('blob:episode-thumbnail'),
      revokeAll: vi.fn(),
    }
    const presenter = createSeriesEpisodeListItemPresenter(objectUrls)

    const [inProgress, unread] = presenter.present([
      { episode: inProgressEpisode },
      { episode: fixture.episode },
    ])

    expect(inProgress?.readingProgress).toEqual({
      status: 'inProgress',
      percent: 40,
      label: '続きから 40%',
    })
    expect(unread).not.toHaveProperty('readingProgress')
  })

  it('一覧の再生成時と破棄時にObject URLを解放する', () => {
    const fixture = createDevelopmentComicFixture()
    const objectUrls = {
      create: vi.fn().mockReturnValue('blob:episode-thumbnail'),
      revokeAll: vi.fn(),
    }
    const presenter = createSeriesEpisodeListItemPresenter(objectUrls)
    const entries = [{ episode: fixture.episode, thumbnailImage: fixture.image }]

    presenter.present(entries)
    presenter.present(entries)
    presenter.dispose()

    expect(objectUrls.revokeAll).toHaveBeenCalledTimes(3)
  })
})
