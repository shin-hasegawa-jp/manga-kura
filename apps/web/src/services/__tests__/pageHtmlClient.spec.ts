import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPageHtml } from '../pageHtmlClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FrontendからのHTML取得', () => {
  it('デフォルトのfetchをWindowコンテキストで呼び出す', async () => {
    const fetchStub = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis)
      return Promise.resolve(
        new Response('<html></html>', { headers: { 'content-type': 'text/html' } }),
      )
    })
    vi.stubGlobal('fetch', fetchStub)

    await expect(fetchPageHtml('https://example.com/comic/1')).resolves.toBe('<html></html>')
    expect(fetchStub).toHaveBeenCalledOnce()
  })

  it.each(['text/html', 'text/html; charset=utf-8', 'application/xhtml+xml'])(
    'HTMLのContent-Typeでは本文を返す: %s',
    async (contentType) => {
      const fetchStub = vi.fn().mockResolvedValue(
        new Response('<html><body>漫画</body></html>', {
          status: 200,
          headers: { 'content-type': contentType },
        }),
      )

      await expect(
        fetchPageHtml('https://example.com/comic/1', { fetch: fetchStub }),
      ).resolves.toBe('<html><body>漫画</body></html>')
      expect(fetchStub).toHaveBeenCalledExactlyOnceWith('https://example.com/comic/1')
    },
  )

  it('HTTPエラーをステータス付きの取得エラーへ変換する', async () => {
    const fetchStub = vi.fn().mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }),
    )

    await expect(
      fetchPageHtml('https://example.com/not-found', { fetch: fetchStub }),
    ).rejects.toMatchObject({
      name: 'PageHtmlFetchError',
      kind: 'http',
      status: 404,
    })
  })

  it('通信失敗をネットワークエラーへ変換する', async () => {
    const fetchStub = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      fetchPageHtml('https://example.com/cors-blocked', { fetch: fetchStub }),
    ).rejects.toMatchObject({
      name: 'PageHtmlFetchError',
      kind: 'network',
    })
  })

  it.each(['text/plain', 'application/json', 'image/png', ''])(
    'HTML以外のContent-Typeを拒否する: %s',
    async (contentType) => {
      const headers = contentType === '' ? undefined : { 'content-type': contentType }
      const body = contentType === '' ? new Uint8Array() : 'HTMLではない本文'
      const fetchStub = vi.fn().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers,
        }),
      )

      await expect(
        fetchPageHtml('https://example.com/not-html', { fetch: fetchStub }),
      ).rejects.toMatchObject({
        name: 'PageHtmlFetchError',
        kind: 'unsupportedContentType',
        contentType,
      })
    },
  )

  it('本文の読込失敗をネットワークエラーへ変換する', async () => {
    const response = new Response('<html></html>', {
      headers: { 'content-type': 'text/html' },
    })
    const text = vi.spyOn(response, 'text').mockRejectedValue(new TypeError('connection closed'))
    const fetchStub = vi.fn().mockResolvedValue(response)

    await expect(
      fetchPageHtml('https://example.com/interrupted', { fetch: fetchStub }),
    ).rejects.toMatchObject({
      name: 'PageHtmlFetchError',
      kind: 'network',
    })
    expect(text).toHaveBeenCalledOnce()
  })
})
