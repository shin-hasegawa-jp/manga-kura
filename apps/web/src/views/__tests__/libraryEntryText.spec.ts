import { describe, expect, it } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { getLibraryEntryText } from '../libraryEntryText'

describe('ライブラリ一覧項目の表示文言', () => {
  it('作品に属する話では作品名と話タイトルを返す', () => {
    const fixture = createDevelopmentComicFixture()

    expect(getLibraryEntryText({ episode: fixture.episode, series: fixture.series })).toEqual({
      episodeId: fixture.episode.id,
      episodeTitle: fixture.episode.title,
      contextLabel: fixture.series.title,
      kind: 'series',
    })
  })

  it('単独の話では判別用の文言と話タイトルを返す', () => {
    const fixture = createDevelopmentComicFixture()
    const standaloneEpisode = {
      ...fixture.episode,
      id: 'standalone-episode-1',
      seriesId: undefined,
      title: '読切漫画',
    }

    expect(getLibraryEntryText({ episode: standaloneEpisode })).toEqual({
      episodeId: standaloneEpisode.id,
      episodeTitle: standaloneEpisode.title,
      contextLabel: '単独の話',
      kind: 'standalone',
    })
  })
})
