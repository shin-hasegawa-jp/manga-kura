import { describe, expect, it } from 'vitest'
import { extractImageSourceCandidates, extractImageSources } from '../imageSourceExtractor'

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
})
