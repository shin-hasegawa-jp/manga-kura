import { describe, expect, it } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { getLibraryEntryText } from '../libraryEntryText'

describe('ライブラリ一覧項目の表示文言', () => {
  it('作品では作品名・所属話数・作品種別を返す', () => {
    const fixture = createDevelopmentComicFixture()

    expect(
      getLibraryEntryText({ kind: 'series', series: fixture.series, episodeCount: 3 }),
    ).toEqual({
      itemId: fixture.series.id,
      title: fixture.series.title,
      kind: 'series',
      kindLabel: '作品',
      detailLabel: '全3話',
    })
  })

  it('話数がある単独の話ではタイトル・話数・単独の話種別を返す', () => {
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '読切漫画',
    }

    expect(getLibraryEntryText({ kind: 'standaloneEpisode', episode: standaloneEpisode })).toEqual({
      itemId: standaloneEpisode.id,
      title: standaloneEpisode.title,
      kind: 'standaloneEpisode',
      kindLabel: '単独の話',
      detailLabel: '第1話',
    })
  })

  it('話数がない単独の話では話数表示を返さない', () => {
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      seriesId: undefined,
      episodeNumber: undefined,
    }

    expect(getLibraryEntryText({ kind: 'standaloneEpisode', episode: standaloneEpisode })).toEqual({
      itemId: standaloneEpisode.id,
      title: standaloneEpisode.title,
      kind: 'standaloneEpisode',
      kindLabel: '単独の話',
    })
  })
})
