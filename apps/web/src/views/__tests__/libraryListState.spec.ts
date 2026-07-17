import { describe, expect, it } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { getLibraryListState } from '../libraryListState'

describe('ライブラリ一覧の表示状態', () => {
  it('読込前は読込中を返す', () => {
    expect(getLibraryListState(undefined)).toEqual({ kind: 'loading' })
  })

  it('保存済みの話がない場合は空状態を返す', () => {
    expect(getLibraryListState([])).toEqual({ kind: 'empty' })
  })

  it('保存済みの話がある場合は一覧状態と読込モデルを返す', () => {
    const fixture = createDevelopmentComicFixture()
    const entries = [{ episode: fixture.episode, series: fixture.series }]

    expect(getLibraryListState(entries)).toEqual({ kind: 'populated', entries })
  })
})
