import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ImageCandidate } from '../imageCandidateFactory'
import { fetchImageBlob, fetchSelectedImageBlobs, ImageBlobFetchError } from '../imageBlobClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

function createCandidate(id: string, isSelected = true): ImageCandidate {
  return {
    id,
    domOrder: Number(id),
    imageUrl: `https://example.com/images/page${id}.png`,
    sourceAttribute: 'src',
    isSelected,
    score: 90,
    selectionReasons: ['sequential-filename'],
    fetchStatus: 'loaded',
    width: 800,
    height: 1200,
  }
}

describe('選択画像のBlob取得', () => {
  it('デフォルトのfetchをWindowコンテキストで呼び出す', async () => {
    const candidate = createCandidate('1')
    const fetchStub = vi.fn(function (this: unknown) {
      expect(this).toBe(globalThis)
      return Promise.resolve(
        new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }),
      )
    })
    vi.stubGlobal('fetch', fetchStub)

    await expect(fetchImageBlob(candidate)).resolves.toMatchObject({ candidateId: candidate.id })
    expect(fetchStub).toHaveBeenCalledOnce()
  })

  it('画像Blobと保存用メタデータを返す', async () => {
    const candidate = createCandidate('1')
    const bytes = new Uint8Array([1, 2, 3, 4])
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'image/png; charset=binary' },
      }),
    )

    const result = await fetchImageBlob(candidate, { fetch: fetchMock })

    expect(result).toEqual({
      candidateId: candidate.id,
      domOrder: candidate.domOrder,
      blob: expect.any(Blob),
      sourceUrl: candidate.imageUrl,
      mimeType: 'image/png',
      fileSize: bytes.byteLength,
      width: 800,
      height: 1200,
    })
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes)
    expect(fetchMock).toHaveBeenCalledWith(candidate.imageUrl)
  })

  it('HTTPエラーをステータス付きで返す', async () => {
    const candidate = createCandidate('1')

    await expect(
      fetchImageBlob(candidate, {
        fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 })),
      }),
    ).rejects.toMatchObject({
      name: 'ImageBlobFetchError',
      kind: 'http',
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
      status: 404,
    })
  })

  it('通信失敗をネットワークエラーへ変換する', async () => {
    const candidate = createCandidate('1')

    await expect(
      fetchImageBlob(candidate, {
        fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
      }),
    ).rejects.toMatchObject({
      name: 'ImageBlobFetchError',
      kind: 'network',
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
    })
  })

  it('画像以外のContent-Typeを専用エラーへ変換する', async () => {
    const candidate = createCandidate('1')

    await expect(
      fetchImageBlob(candidate, {
        fetch: vi.fn<typeof fetch>().mockResolvedValue(
          new Response('<html></html>', {
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
        ),
      }),
    ).rejects.toMatchObject({
      name: 'ImageBlobFetchError',
      kind: 'unsupportedContentType',
      contentType: 'text/html; charset=utf-8',
    })
  })

  it('選択済み候補だけを元の順番で取得する', async () => {
    const candidates = [createCandidate('1'), createCandidate('2', false), createCandidate('3')]
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } }),
      )

    const result = await fetchSelectedImageBlobs(candidates, { fetch: fetchMock })

    expect(result.status).toBe('success')
    expect(result.images.map(({ candidateId }) => candidateId)).toEqual(['1', '3'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).not.toHaveBeenCalledWith(candidates[1]?.imageUrl)
  })

  it('一部画像の取得失敗を成功画像と分けて返す', async () => {
    const candidates = [createCandidate('1'), createCandidate('2'), createCandidate('3')]
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([3]), { headers: { 'content-type': 'image/webp' } }),
      )

    const result = await fetchSelectedImageBlobs(candidates, { fetch: fetchMock })

    expect(result.status).toBe('partial-failure')
    expect(result.images.map(({ candidateId }) => candidateId)).toEqual(['1', '3'])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toBeInstanceOf(ImageBlobFetchError)
    expect(result.failures[0]).toMatchObject({ candidateId: '2', kind: 'http', status: 403 })
  })

  it('すべての選択画像が失敗した場合は失敗結果を返す', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))

    const result = await fetchSelectedImageBlobs([createCandidate('1'), createCandidate('2')], {
      fetch: fetchMock,
    })

    expect(result.status).toBe('failure')
    expect(result.images).toEqual([])
    expect(result.failures.map(({ candidateId, kind }) => ({ candidateId, kind }))).toEqual([
      { candidateId: '1', kind: 'network' },
      { candidateId: '2', kind: 'network' },
    ])
  })
})
