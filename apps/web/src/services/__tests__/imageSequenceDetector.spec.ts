import { describe, expect, it } from 'vitest'
import { extractImageSequenceFilename, isLikelyImageSequence } from '../imageSequenceDetector'

describe('画像ファイル名の連番判定', () => {
  it.each([
    ['1.jpg', '', 1, '1', 'jpg'],
    ['01.jpg', '', 1, '01', 'jpg'],
    ['001.jpeg', '', 1, '001', 'jpeg'],
    ['page1.webp', 'page', 1, '1', 'webp'],
    ['comic_001.png', 'comic_', 1, '001', 'png'],
  ])(
    '%sから接頭辞・数値・ゼロ埋め表現・拡張子を抽出する',
    (filename, prefix, number, numberText, extension) => {
      expect(extractImageSequenceFilename(`https://example.com/images/${filename}`)).toEqual({
        prefix,
        number,
        numberText,
        extension,
      })
    },
  )

  it('共通の接頭辞と拡張子を持つ連続番号を連番と判定する', () => {
    expect(
      isLikelyImageSequence([
        'https://example.com/comic/page001.jpg',
        'https://example.com/comic/page002.jpg',
        'https://example.com/comic/page003.jpg',
      ]),
    ).toBe(true)
  })

  it('URLの並び順にかかわらず連続番号を連番と判定する', () => {
    expect(
      isLikelyImageSequence([
        'https://example.com/comic/03.webp',
        'https://example.com/comic/01.webp',
        'https://example.com/comic/02.webp',
      ]),
    ).toBe(true)
  })

  it.each([
    [
      '接頭辞が異なる',
      ['https://example.com/images/page01.jpg', 'https://example.com/images/thumbnail02.jpg'],
    ],
    [
      '拡張子が異なる',
      ['https://example.com/images/page01.jpg', 'https://example.com/images/page02.png'],
    ],
    [
      '番号に欠番がある',
      ['https://example.com/images/page01.jpg', 'https://example.com/images/page03.jpg'],
    ],
    [
      '数字がディレクトリとクエリにしかない',
      [
        'https://example.com/2026/chapter1/cover.jpg?size=1',
        'https://example.com/2026/chapter2/banner.jpg?size=2',
      ],
    ],
    [
      '数字がファイル名末尾にない',
      [
        'https://example.com/images/campaign2026-summer.jpg',
        'https://example.com/images/campaign2027-winter.jpg',
      ],
    ],
  ])('%s場合は連番と判定しない', (_caseName, imageUrls) => {
    expect(isLikelyImageSequence(imageUrls)).toBe(false)
  })

  it('重複した同じ番号だけでは連番と判定しない', () => {
    expect(
      isLikelyImageSequence([
        'https://example.com/images/page01.jpg',
        'https://cdn.example.com/other/page01.jpg',
      ]),
    ).toBe(false)
  })

  it.each([
    'not-a-url',
    'data:image/png;base64,1',
    'https://example.com/images/page.jpg',
    'https://example.com/images/page1.svg',
  ])('連番画像として扱えないURLからは数値を抽出しない: %s', (imageUrl) => {
    expect(extractImageSequenceFilename(imageUrl)).toBeUndefined()
  })
})
