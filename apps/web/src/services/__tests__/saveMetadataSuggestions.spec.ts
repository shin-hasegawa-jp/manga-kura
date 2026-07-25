import { describe, expect, it } from 'vitest'
import { createSaveMetadataSuggestions } from '../saveMetadataSuggestions'

describe('保存情報候補', () => {
  it.each([
    ['作品名 第12話', 12],
    ['作品名 12話', 12],
    ['作品名 episode-12', 12],
    ['作品名 ep_012', 12],
  ])('ページタイトルの明示的な話数表記を抽出する: %s', (pageTitle, episodeNumber) => {
    expect(
      createSaveMetadataSuggestions(pageTitle, 'https://example.com/comic').episodeNumber,
    ).toBe(episodeNumber)
  })

  it('ページタイトルの空白とサイト名区切りを正規化する', () => {
    expect(
      createSaveMetadataSuggestions('  作品名   第12話  | サイト名 ', 'https://example.com/comic'),
    ).toEqual({
      pageTitle: '作品名 第12話 | サイト名',
      seriesTitle: '作品名',
      episodeTitle: '作品名 第12話',
      episodeNumber: 12,
    })
  })

  it('タイトルに話数がない場合はURLパスの明示表記を利用する', () => {
    expect(
      createSaveMetadataSuggestions('作品名', 'https://example.com/comic/episode-27/index.html'),
    ).toMatchObject({ episodeNumber: 27 })
  })

  it.each([
    ['2026年7月25日 作品名', 'https://example.com/2026/07/25'],
    ['作品名', 'https://example.com/images/001.jpg'],
  ])('日付や画像番号を話数として扱わない', (pageTitle, pageUrl) => {
    expect(createSaveMetadataSuggestions(pageTitle, pageUrl).episodeNumber).toBeUndefined()
  })

  it('複数の異なる話数表記がある場合は話数を推定しない', () => {
    expect(
      createSaveMetadataSuggestions('第1話から第12話', 'https://example.com/episode-12')
        .episodeNumber,
    ).toBeUndefined()
  })

  it('ページタイトルがない場合は根拠のないタイトル候補を返さない', () => {
    expect(createSaveMetadataSuggestions(undefined, 'https://example.com/comic')).toEqual({})
  })
})
