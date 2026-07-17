import { describe, expect, it } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { getSeriesDetailState } from '../seriesDetailState'

describe('作品詳細画面の表示状態', () => {
  it('読込中は読込中状態を返す', () => {
    expect(getSeriesDetailState(true, undefined)).toEqual({ kind: 'loading' })
  })

  it('読込後に作品がない場合は未検出状態を返す', () => {
    expect(getSeriesDetailState(false, undefined)).toEqual({ kind: 'notFound' })
  })

  it('所属する話がない場合は空状態を返す', () => {
    const fixture = createDevelopmentComicFixture()
    const details = { series: fixture.series, episodes: [] }

    expect(getSeriesDetailState(false, details)).toEqual({ kind: 'empty', details })
  })

  it('所属する話がある場合は一覧状態を返す', () => {
    const fixture = createDevelopmentComicFixture()
    const details = { series: fixture.series, episodes: [{ episode: fixture.episode }] }

    expect(getSeriesDetailState(false, details)).toEqual({ kind: 'populated', details })
  })
})
