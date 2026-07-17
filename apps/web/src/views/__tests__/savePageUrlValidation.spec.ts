import { describe, expect, it, vi } from 'vitest'
import { submitPageUrl, validatePageUrl } from '../savePageUrlValidation'

describe('取得元ページURLの検証', () => {
  it.each([
    [' https://Example.COM/comic/1?view=all ', 'https://example.com/comic/1?view=all'],
    ['http://example.com/comic/1', 'http://example.com/comic/1'],
  ])('httpまたはhttpsの絶対URLを正規化する', (input, expectedUrl) => {
    expect(validatePageUrl(input)).toEqual({ status: 'valid', url: expectedUrl })
  })

  it.each([
    ['', 'URLを入力してください。'],
    ['   ', 'URLを入力してください。'],
    ['/comic/1', '有効な絶対URLを入力してください。'],
    ['not-a-url', '有効な絶対URLを入力してください。'],
    ['ftp://example.com/comic/1', 'httpまたはhttpsのURLを入力してください。'],
    ['javascript:alert(1)', 'httpまたはhttpsのURLを入力してください。'],
  ])('許可しない入力をエラーにする', (input, expectedMessage) => {
    expect(validatePageUrl(input)).toEqual({ status: 'invalid', message: expectedMessage })
  })

  it('正常なURLだけを後続処理へ渡す', async () => {
    const onValidUrl = vi.fn()

    await expect(submitPageUrl('https://example.com/comic/1', onValidUrl)).resolves.toEqual({
      status: 'success',
      message: 'URLを確認しました。',
      url: 'https://example.com/comic/1',
    })
    expect(onValidUrl).toHaveBeenCalledExactlyOnceWith('https://example.com/comic/1')
  })

  it('不正なURLでは後続処理を開始しない', async () => {
    const onValidUrl = vi.fn()

    await expect(submitPageUrl('file:///comic/1', onValidUrl)).resolves.toEqual({
      status: 'error',
      message: 'httpまたはhttpsのURLを入力してください。',
    })
    expect(onValidUrl).not.toHaveBeenCalled()
  })
})
