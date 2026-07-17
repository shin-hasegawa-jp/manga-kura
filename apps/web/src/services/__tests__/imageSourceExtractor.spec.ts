import { describe, expect, it } from 'vitest'
import {
  extractImageSourceCandidates,
  extractImageSources,
  resolveImageSourceCandidates,
  selectBestSourceFromSrcset,
} from '../imageSourceExtractor'

describe('img要素のsrc抽出', () => {
  it('画像URLをDOM上の出現順で抽出する', () => {
    const html = `
      <!doctype html>
      <html>
        <body>
          <img src="/images/page-01.jpg" alt="1ページ目">
          <section>
            <img src="https://cdn.example.com/page-02.jpg" alt="2ページ目">
          </section>
          <img src="//cdn.example.com/page-03.jpg" alt="3ページ目">
        </body>
      </html>
    `

    expect(extractImageSources(html)).toEqual([
      '/images/page-01.jpg',
      'https://cdn.example.com/page-02.jpg',
      '//cdn.example.com/page-03.jpg',
    ])
  })

  it('画像がないHTMLでは空配列を返す', () => {
    expect(extractImageSources('<html><body><p>画像なし</p></body></html>')).toEqual([])
  })

  it('srcがないimg要素と空のsrcを候補から除外する', () => {
    const html = `
      <img alt="srcなし">
      <img src="">
      <img src="   ">
      <img src=" /images/page-01.jpg ">
    `

    expect(extractImageSources(html)).toEqual(['/images/page-01.jpg'])
  })

  it('閉じタグが不足したHTML断片もブラウザの解析結果から抽出する', () => {
    const malformedHtml = `
      <main>
        <img src="/images/page-01.jpg">
        <div><img src="/images/page-02.jpg">
    `

    expect(extractImageSources(malformedHtml)).toEqual([
      '/images/page-01.jpg',
      '/images/page-02.jpg',
    ])
  })

  it('重複URLを最初の出現位置を保って除外する', () => {
    const html = `
      <img src="/images/page-01.jpg">
      <img src="/images/page-02.jpg">
      <img src="/images/page-01.jpg">
      <img src=" /images/page-02.jpg ">
      <img src="/images/page-03.jpg">
    `

    expect(extractImageSources(html)).toEqual([
      '/images/page-01.jpg',
      '/images/page-02.jpg',
      '/images/page-03.jpg',
    ])
  })

  it.each([
    ['data-src', '/images/data-src.jpg'],
    ['data-original', '/images/data-original.jpg'],
    ['data-lazy-src', '/images/data-lazy-src.jpg'],
    ['data-original-src', '/images/data-original-src.jpg'],
    ['data-lazy', '/images/data-lazy.jpg'],
  ])('%sからlazy-load先の画像URLを抽出する', (attribute, source) => {
    expect(extractImageSources(`<img ${attribute}="${source}">`)).toEqual([source])
  })

  it('同じimgでは優先順位が高い属性を抽出元として採用する', () => {
    const html = `
      <img
        src="data:image/gif;base64,placeholder"
        data-lazy="/images/data-lazy.jpg"
        data-original-src="/images/data-original-src.jpg"
        data-lazy-src="/images/data-lazy-src.jpg"
        data-original="/images/data-original.jpg"
        data-src="/images/data-src.jpg"
      >
    `

    expect(extractImageSourceCandidates(html)).toEqual([
      { source: '/images/data-src.jpg', attribute: 'data-src' },
    ])
  })

  it('空のlazy-load属性を飛ばして次の有効な属性を採用する', () => {
    const html = `
      <img
        src="data:image/gif;base64,placeholder"
        data-src="   "
        data-original=""
        data-lazy-src="/images/actual-page.jpg"
      >
      <img src="/images/src-fallback.jpg" data-src="">
    `

    expect(extractImageSourceCandidates(html)).toEqual([
      { source: '/images/actual-page.jpg', attribute: 'data-lazy-src' },
      { source: '/images/src-fallback.jpg', attribute: 'src' },
    ])
  })

  it('lazy-load属性とsrcに同じURLがある場合も最初の候補だけを残す', () => {
    const html = `
      <img data-original="/images/page-01.jpg" src="placeholder.gif">
      <img src="/images/page-01.jpg">
    `

    expect(extractImageSourceCandidates(html)).toEqual([
      { source: '/images/page-01.jpg', attribute: 'data-original' },
    ])
  })

  it('幅記述子を持つsrcsetから最大幅の画像を選択する', () => {
    expect(
      selectBestSourceFromSrcset(`
        /images/page-320.jpg 320w,
        /images/page-1280.jpg 1280w,
        /images/page-640.jpg 640w
      `),
    ).toBe('/images/page-1280.jpg')
  })

  it('画素密度記述子を持つsrcsetから最大倍率の画像を選択する', () => {
    expect(
      selectBestSourceFromSrcset(`
        /images/page.jpg 1x,
        /images/page@3x.jpg 3x,
        /images/page@2x.jpg 2x
      `),
    ).toBe('/images/page@3x.jpg')
  })

  it('記述子がない候補を1倍として扱う', () => {
    expect(selectBestSourceFromSrcset('/images/page.jpg, /images/page@2x.jpg 2x')).toBe(
      '/images/page@2x.jpg',
    )
  })

  it('data-srcsetをsrcsetや単一URL属性より優先する', () => {
    const html = `
      <img
        src="placeholder.gif"
        data-src="/images/data-src.jpg"
        srcset="/images/srcset-1x.jpg 1x, /images/srcset-2x.jpg 2x"
        data-srcset="/images/lazy-640.jpg 640w, /images/lazy-1280.jpg 1280w"
      >
    `

    expect(extractImageSourceCandidates(html)).toEqual([
      { source: '/images/lazy-1280.jpg', attribute: 'data-srcset' },
    ])
  })

  it('srcsetから選択したURLを通常の候補へ含める', () => {
    const html = `
      <img srcset="/images/page-1.jpg 1x, /images/page-1@2x.jpg 2x">
      <img data-srcset="/images/page-2.jpg 400w, /images/page-2-large.jpg 800w">
    `

    expect(extractImageSourceCandidates(html)).toEqual([
      { source: '/images/page-1@2x.jpg', attribute: 'srcset' },
      { source: '/images/page-2-large.jpg', attribute: 'data-srcset' },
    ])
  })

  it.each([
    ['', undefined],
    [' , , ', undefined],
    ['/images/page.jpg 0w', undefined],
    ['/images/page.jpg 0x', undefined],
    ['/images/page.jpg invalid', undefined],
    ['/images/small.jpg 320w, /images/large.jpg 2x', undefined],
  ])('空または不正なsrcsetを選択しない: %s', (srcset, expected) => {
    expect(selectBestSourceFromSrcset(srcset)).toBe(expected)
  })

  it('不正なsrcsetでは次の有効な画像属性へフォールバックする', () => {
    const html = `
      <img
        data-srcset="/images/page.jpg invalid"
        srcset=""
        data-src="/images/fallback.jpg"
        src="placeholder.gif"
      >
    `

    expect(extractImageSourceCandidates(html)).toEqual([
      { source: '/images/fallback.jpg', attribute: 'data-src' },
    ])
  })

  it('ページURLを基準に各形式の画像URLを絶対URL化する', () => {
    const html = `
      <img src="//cdn.example.com/images/protocol-relative.jpg">
      <img src="/images/root-relative.jpg">
      <img src="images/path-relative.jpg">
      <img src="?image=queried">
      <img src="https://static.example.com/images/absolute.jpg">
    `

    expect(resolveImageSourceCandidates(html, 'https://example.com/comic/episode/1')).toEqual([
      {
        source: 'https://cdn.example.com/images/protocol-relative.jpg',
        attribute: 'src',
      },
      { source: 'https://example.com/images/root-relative.jpg', attribute: 'src' },
      {
        source: 'https://example.com/comic/episode/images/path-relative.jpg',
        attribute: 'src',
      },
      { source: 'https://example.com/comic/episode/1?image=queried', attribute: 'src' },
      { source: 'https://static.example.com/images/absolute.jpg', attribute: 'src' },
    ])
  })

  it('有効なbase要素を画像URL解決の基準にする', () => {
    const html = `
      <base href="https://assets.example.com/comics/series-a/">
      <base href="https://ignored.example.com/">
      <img src="pages/01.jpg">
      <img src="/shared/cover.jpg">
    `

    expect(resolveImageSourceCandidates(html, 'https://example.com/reader/1')).toEqual([
      {
        source: 'https://assets.example.com/comics/series-a/pages/01.jpg',
        attribute: 'src',
      },
      { source: 'https://assets.example.com/shared/cover.jpg', attribute: 'src' },
    ])
  })

  it.each([
    '<base href="http://[invalid">',
    '<base href="data:text/plain,invalid">',
    '<base href="">',
  ])('無効または許可しないbase要素ではページURLへフォールバックする', (baseElement) => {
    const html = `${baseElement}<img src="images/page.jpg">`

    expect(resolveImageSourceCandidates(html, 'https://example.com/comic/1')).toEqual([
      { source: 'https://example.com/comic/images/page.jpg', attribute: 'src' },
    ])
  })

  it('解決不能またはhttpとhttps以外の画像URLを除外する', () => {
    const html = `
      <img src="http://[invalid">
      <img src="data:image/png;base64,placeholder">
      <img src="blob:https://example.com/image-id">
      <img src="file:///images/page.jpg">
      <img src="javascript:alert(1)">
      <img src="https://example.com/images/valid.jpg">
    `

    expect(resolveImageSourceCandidates(html, 'https://example.com/comic/1')).toEqual([
      { source: 'https://example.com/images/valid.jpg', attribute: 'src' },
    ])
  })

  it('絶対URL化後に重複する候補を最初の出現順を保って除外する', () => {
    const html = `
      <img src="/images/page.jpg">
      <img data-src="https://example.com/images/page.jpg">
      <img src="../images/page.jpg">
    `

    expect(resolveImageSourceCandidates(html, 'https://example.com/comic/1')).toEqual([
      { source: 'https://example.com/images/page.jpg', attribute: 'src' },
    ])
  })
})
