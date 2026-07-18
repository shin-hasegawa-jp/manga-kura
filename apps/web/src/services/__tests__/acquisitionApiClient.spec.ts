import { describe, expect, it, vi } from 'vitest'
import {
  AcquisitionApiClientError,
  analyzePageViaApi,
  fetchProxiedImage,
  type AcquisitionApiClientDependencies,
} from '../acquisitionApiClient'
import { toImageBlobFetchError, toPageHtmlFetchError } from '../acquisitionApiErrorAdapters'

const apiBaseUrl = 'https://api.example.com/base/'

function createDependencies(fetchStub: typeof fetch): AcquisitionApiClientDependencies {
  return { fetch: fetchStub, apiBaseUrl }
}

function createAnalysisResponse(): object {
  return {
    pageUrl: 'https://example.com/comic/1',
    acquisitionMethod: 'api',
    candidates: [
      {
        id: 'image-candidate-0',
        domOrder: 0,
        imageUrl: 'https://cdn.example.com/001.jpg',
        sourceAttribute: 'data-src',
        proxyToken: 'signed-token',
      },
    ],
  }
}

function createApiErrorResponse(): object {
  return {
    error: {
      code: 'upstream_timeout',
      message: '取得先がタイムアウトしました。',
      retryable: true,
      details: { timeoutSeconds: 10 },
    },
  }
}

describe('取得APIクライアント', () => {
  it('ページ解析APIへURLを送信し、検証済みレスポンスを返す', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(Response.json(createAnalysisResponse(), { status: 200 }))

    await expect(
      analyzePageViaApi('https://example.com/comic/1', createDependencies(fetchStub)),
    ).resolves.toEqual(createAnalysisResponse())
    expect(fetchStub).toHaveBeenCalledOnce()
    const requestUrl = fetchStub.mock.calls[0]?.[0]
    const requestInit = fetchStub.mock.calls[0]?.[1]
    expect(requestUrl).toEqual(new URL('v1/pages/analyze', apiBaseUrl))
    expect(requestInit).toMatchObject({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/comic/1' }),
    })
  })

  it.each([
    ['候補のURLが不正', { ...createAnalysisResponse(), candidates: [{ imageUrl: 'not-url' }] }],
    ['取得方法が不正', { ...createAnalysisResponse(), acquisitionMethod: 'browser' }],
  ])('ページ解析APIの不正な成功レスポンスを拒否する: %s', async (_name, payload) => {
    const fetchStub = vi.fn().mockResolvedValue(Response.json(payload))

    await expect(
      analyzePageViaApi('https://example.com/comic/1', createDependencies(fetchStub)),
    ).rejects.toMatchObject({
      name: 'AcquisitionApiClientError',
      kind: 'invalidResponse',
    })
  })

  it('検証済みの共通APIエラーをコードと再試行可否付きで返す', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(Response.json(createApiErrorResponse(), { status: 504 }))

    await expect(
      analyzePageViaApi('https://example.com/comic/1', createDependencies(fetchStub)),
    ).rejects.toMatchObject({
      name: 'AcquisitionApiClientError',
      kind: 'api',
      status: 504,
      code: 'upstream_timeout',
      retryable: true,
      apiDetails: { timeoutSeconds: 10 },
    })
  })

  it.each([
    ['JSONではない', new Response('gateway error', { status: 502 })],
    ['共通形式ではない', Response.json({ message: 'error' }, { status: 502 })],
  ])('不正なAPIエラーレスポンスを拒否する: %s', async (_name, response) => {
    const fetchStub = vi.fn().mockResolvedValue(response)

    await expect(
      analyzePageViaApi('https://example.com/comic/1', createDependencies(fetchStub)),
    ).rejects.toMatchObject({ kind: 'invalidResponse', status: 502 })
  })

  it('ページ解析APIの通信失敗を取得APIエラーへ変換する', async () => {
    const fetchStub = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      analyzePageViaApi('https://example.com/comic/1', createDependencies(fetchStub)),
    ).rejects.toMatchObject({ kind: 'network' })
  })

  it('画像中継APIへトークンを安全に渡して画像情報を返す', async () => {
    const blob = new Blob(['image'], { type: 'image/jpeg' })
    const fetchStub = vi
      .fn()
      .mockResolvedValue(
        new Response(blob, { headers: { 'content-type': 'image/jpeg; charset=binary' } }),
      )

    const result = await fetchProxiedImage('a+b&c', createDependencies(fetchStub))

    expect(result).toMatchObject({ mimeType: 'image/jpeg' })
    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.fileSize).toBe(result.blob.size)
    expect(fetchStub).toHaveBeenCalledExactlyOnceWith(
      new URL('https://api.example.com/base/v1/images/proxy?token=a%2Bb%26c'),
    )
  })

  it('画像中継APIの非画像レスポンスを拒否する', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(new Response('text', { headers: { 'content-type': 'text/plain' } }))

    await expect(fetchProxiedImage('token', createDependencies(fetchStub))).rejects.toMatchObject({
      kind: 'unsupportedContentType',
      contentType: 'text/plain',
    })
  })

  it('画像中継APIの共通エラーも検証する', async () => {
    const fetchStub = vi
      .fn()
      .mockResolvedValue(Response.json(createApiErrorResponse(), { status: 504 }))

    await expect(fetchProxiedImage('token', createDependencies(fetchStub))).rejects.toMatchObject({
      kind: 'api',
      code: 'upstream_timeout',
    })
  })

  it('取得APIエラーを既存のページ取得エラーへ変換する', () => {
    const error = new AcquisitionApiClientError('api', '取得できません。', {
      status: 429,
      code: 'rate_limited',
    })

    expect(toPageHtmlFetchError(error)).toMatchObject({
      name: 'PageHtmlFetchError',
      kind: 'http',
      status: 429,
    })
  })

  it('取得APIエラーを既存の画像取得エラーへ変換する', () => {
    const error = new AcquisitionApiClientError('unsupportedContentType', '画像ではありません。', {
      contentType: 'text/html',
    })

    expect(
      toImageBlobFetchError(error, {
        id: 'image-candidate-1',
        imageUrl: 'https://example.com/001.jpg',
      }),
    ).toMatchObject({
      name: 'ImageBlobFetchError',
      kind: 'unsupportedContentType',
      candidateId: 'image-candidate-1',
      contentType: 'text/html',
    })
  })

  it('不正レスポンスを既存のネットワーク取得エラーへ変換する', () => {
    const error = new AcquisitionApiClientError('invalidResponse', '形式が不正です。', {
      status: 200,
    })

    expect(toPageHtmlFetchError(error)).toMatchObject({ kind: 'network' })
    expect(
      toImageBlobFetchError(error, {
        id: 'image-candidate-1',
        imageUrl: 'https://example.com/001.jpg',
      }),
    ).toMatchObject({ kind: 'network' })
  })
})
