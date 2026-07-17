import { describe, expect, it } from 'vitest'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import type { TopLevelLibraryEntry } from '@/database/repository'
import { getLibraryListState } from '../libraryListState'

describe('ライブラリ一覧の表示状態', () => {
  it('読込前は読込中を返す', () => {
    expect(getLibraryListState(undefined)).toEqual({ kind: 'loading' })
  })

  it('保存済みの作品や話がない場合は空状態を返す', () => {
    expect(getLibraryListState([])).toEqual({ kind: 'empty' })
  })

  it('保存済みの作品がある場合は一覧状態と読込モデルを返す', () => {
    const fixture = createDevelopmentComicFixture()
    const entries: TopLevelLibraryEntry[] = [
      { kind: 'series', series: fixture.series, episodeCount: 1 },
    ]

    expect(getLibraryListState(entries)).toEqual({ kind: 'populated', entries })
  })
})
