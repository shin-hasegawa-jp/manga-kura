import { afterEach, describe, expect, it, vi } from 'vitest'
import { AcquisitionApiClientError } from '../acquisitionApiClient'
import {
  createSelectedImageBlobFetcher,
  fetchImageBlob,
  fetchSelectedImageBlobs,
  ImageBlobFetchError,
} from '../imageBlobClient'
import type { ImageCandidate } from '../imageCandidateFactory'

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
    proxyToken: `proxy-token-${id}`,
    previewToken: `preview-token-${id}`,
    width: 800,
    height: 1200,
  }
}

function createProxiedImage() {
  const blob = new Blob(['proxied-image'], { type: 'image/webp' })
  return { blob, mimeType: 'image/webp', fileSize: blob.size }
}

describe('選択画像のBlob取得', () => {
  it('候補の中継トークンを使って画像と保存用メタデータを取得する', async () => {
    const candidate = createCandidate('1')
    const proxiedImage = createProxiedImage()
    const directFetch = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', directFetch)
    const fetchProxiedImage = vi.fn(async () => proxiedImage)

    await expect(fetchImageBlob(candidate, { fetchProxiedImage })).resolves.toEqual({
      candidateId: candidate.id,
      domOrder: candidate.domOrder,
      blob: proxiedImage.blob,
      sourceUrl: candidate.imageUrl,
      mimeType: proxiedImage.mimeType,
      fileSize: proxiedImage.fileSize,
      width: 800,
      height: 1200,
    })
    expect(fetchProxiedImage).toHaveBeenCalledExactlyOnceWith(candidate.proxyToken)
    expect(directFetch).not.toHaveBeenCalled()
  })

  it('事前寸法がない場合は中継Blobから寸法を取得する', async () => {
    const candidate = { ...createCandidate('1'), width: undefined, height: undefined }
    const proxiedImage = createProxiedImage()
    const loadBlobDimensions = vi.fn(async () => ({ width: 700, height: 963 }))

    await expect(
      fetchImageBlob(candidate, {
        fetchProxiedImage: vi.fn(async () => proxiedImage),
        loadBlobDimensions,
      }),
    ).resolves.toMatchObject({ candidateId: candidate.id, width: 700, height: 963 })
    expect(loadBlobDimensions).toHaveBeenCalledExactlyOnceWith(proxiedImage.blob)
  })

  it('中継Blobから有効な寸法を取得できない場合は候補付きエラーを返す', async () => {
    const candidate = { ...createCandidate('1'), width: undefined, height: undefined }

    await expect(
      fetchImageBlob(candidate, {
        fetchProxiedImage: vi.fn(async () => createProxiedImage()),
        loadBlobDimensions: vi.fn(async () => ({ width: 0, height: 0 })),
      }),
    ).rejects.toMatchObject({
      name: 'ImageBlobFetchError',
      kind: 'missingDimensions',
      candidateId: candidate.id,
    })
  })

  it('画像中継APIエラーを候補を特定できる既存エラーへ変換する', async () => {
    const candidate = createCandidate('2')
    const fetchProxiedImage = vi.fn().mockRejectedValue(
      new AcquisitionApiClientError('api', 'トークンが無効です。', {
        status: 400,
        code: 'invalid_proxy_token',
      }),
    )

    await expect(fetchImageBlob(candidate, { fetchProxiedImage })).rejects.toMatchObject({
      name: 'ImageBlobFetchError',
      kind: 'http',
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
      status: 400,
    })
  })

  it('選択済み候補だけを元の順番で取得する', async () => {
    const candidates = [createCandidate('1'), createCandidate('2', false), createCandidate('3')]
    const fetchProxiedImage = vi.fn(async () => createProxiedImage())

    const result = await fetchSelectedImageBlobs(candidates, {
      fetchProxiedImage,
    })

    expect(result.status).toBe('success')
    expect(result.images.map(({ candidateId }) => candidateId)).toEqual(['1', '3'])
    expect(fetchProxiedImage).toHaveBeenCalledTimes(2)
    expect(fetchProxiedImage).not.toHaveBeenCalledWith(candidates[1]?.proxyToken)
  })

  it('変更前は選択画像を1件ずつ取得する', async () => {
    const candidates = [createCandidate('1'), createCandidate('2'), createCandidate('3')]
    let activeCount = 0
    let maximumActiveCount = 0
    const fetchProxiedImage = vi.fn(async () => {
      activeCount += 1
      maximumActiveCount = Math.max(maximumActiveCount, activeCount)
      await Promise.resolve()
      activeCount -= 1
      return createProxiedImage()
    })

    await fetchSelectedImageBlobs(candidates, { fetchProxiedImage })

    expect(maximumActiveCount).toBe(1)
  })

  it('一部画像の取得失敗を成功画像と分けて返す', async () => {
    const candidates = [createCandidate('1'), createCandidate('2'), createCandidate('3')]
    const fetchProxiedImage = vi
      .fn()
      .mockResolvedValueOnce(createProxiedImage())
      .mockRejectedValueOnce(
        new AcquisitionApiClientError('api', '取得できません。', { status: 403 }),
      )
      .mockResolvedValueOnce(createProxiedImage())

    const result = await fetchSelectedImageBlobs(candidates, {
      fetchProxiedImage,
    })

    expect(result.status).toBe('partial-failure')
    expect(result.images.map(({ candidateId }) => candidateId)).toEqual(['1', '3'])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toBeInstanceOf(ImageBlobFetchError)
    expect(result.failures[0]).toMatchObject({ candidateId: '2', kind: 'http', status: 403 })
  })

  it('すべての選択画像が失敗した場合は失敗結果を返す', async () => {
    const fetchProxiedImage = vi
      .fn()
      .mockRejectedValue(new AcquisitionApiClientError('network', '中継失敗'))

    const result = await fetchSelectedImageBlobs([createCandidate('1'), createCandidate('2')], {
      fetchProxiedImage,
    })

    expect(result.status).toBe('failure')
    expect(result.images).toEqual([])
    expect(result.failures.map(({ candidateId, kind }) => ({ candidateId, kind }))).toEqual([
      { candidateId: '1', kind: 'network' },
      { candidateId: '2', kind: 'network' },
    ])
  })

  it('再試行時は取得済み画像を再中継せず失敗候補だけを取得する', async () => {
    const firstCandidate = createCandidate('1')
    const secondCandidate = createCandidate('2')
    const fetchProxiedImage = vi
      .fn()
      .mockResolvedValueOnce(createProxiedImage())
      .mockRejectedValueOnce(new AcquisitionApiClientError('network', '中継失敗'))
      .mockResolvedValueOnce(createProxiedImage())
    const fetchImages = createSelectedImageBlobFetcher({
      fetchProxiedImage,
    })

    await expect(fetchImages([firstCandidate, secondCandidate])).resolves.toMatchObject({
      status: 'partial-failure',
      images: [expect.objectContaining({ candidateId: '1' })],
      failures: [expect.objectContaining({ candidateId: '2' })],
    })
    await expect(fetchImages([firstCandidate, secondCandidate])).resolves.toMatchObject({
      status: 'success',
      images: [
        expect.objectContaining({ candidateId: '1' }),
        expect.objectContaining({ candidateId: '2' }),
      ],
    })
    expect(fetchProxiedImage).toHaveBeenCalledTimes(3)
  })
})
