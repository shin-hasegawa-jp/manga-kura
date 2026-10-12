import { describe, expect, it } from 'vitest'
import { getSourcePageLink } from '../sourcePageLink'

describe('取得元ページへのリンク', () => {
  it.each(['http://example.com/comic', 'https://example.com/comic?episode=2#page3'])(
    '取得元のWebページURLをクエリとフラグメントを含めて保持する: %s',
    (url) => {
      expect(getSourcePageLink(url)).toBe(url)
    },
  )

  it.each([
    undefined,
    '',
    '/comic',
    'javascript:alert(1)',
    'data:text/html,comic',
    'file:///comic',
  ])('Webページ以外や不正なURLはリンクにしない: %s', (url) => {
    expect(getSourcePageLink(url)).toBeUndefined()
  })
})
