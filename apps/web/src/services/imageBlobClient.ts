import {
  AcquisitionApiClientError,
  fetchProxiedImage,
  type ProxiedImage,
} from './acquisitionApiClient'
import type { ImageCandidate } from './imageCandidateFactory'

export type ImageBlobFetchErrorKind =
  | 'http'
  | 'network'
  | 'unsupportedContentType'
  | 'missingDimensions'

export interface ImageBlobFetchErrorDetails {
  candidateId: string
  imageUrl: string
  status?: number
  contentType?: string
}

export class ImageBlobFetchError extends Error {
  readonly kind: ImageBlobFetchErrorKind
  readonly candidateId: string
  readonly imageUrl: string
  readonly status?: number
  readonly contentType?: string

  constructor(kind: ImageBlobFetchErrorKind, message: string, details: ImageBlobFetchErrorDetails) {
    super(message)
    this.name = 'ImageBlobFetchError'
    this.kind = kind
    this.candidateId = details.candidateId
    this.imageUrl = details.imageUrl
    this.status = details.status
    this.contentType = details.contentType
  }
}

export interface FetchedImageBlob {
  candidateId: string
  domOrder: number
  blob: Blob
  sourceUrl: string
  mimeType: string
  fileSize: number
  width: number
  height: number
}

export type ImageBlobBatchFetchResult =
  | { status: 'success'; images: FetchedImageBlob[]; failures: [] }
  | {
      status: 'partial-failure'
      images: FetchedImageBlob[]
      failures: ImageBlobFetchError[]
    }
  | { status: 'failure'; images: []; failures: ImageBlobFetchError[] }

export interface ImageBlobClientDependencies {
  fetch: typeof fetch
  fetchProxiedImage?(proxyToken: string): Promise<ProxiedImage>
}

const defaultDependencies: ImageBlobClientDependencies = {
  fetch: (input, init) => globalThis.fetch(input, init),
}

function getImageMediaType(contentType: string): string | undefined {
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType?.startsWith('image/') ? mediaType : undefined
}

function toApiImageFetchError(
  error: AcquisitionApiClientError,
  candidate: ImageCandidate,
): ImageBlobFetchError {
  const details = {
    candidateId: candidate.id,
    imageUrl: candidate.imageUrl,
    status: error.status,
    contentType: error.contentType,
  }
  if (error.kind === 'unsupportedContentType' || error.code === 'unsupported_content_type') {
    return new ImageBlobFetchError('unsupportedContentType', error.message, details)
  }
  if (error.kind === 'api') {
    return new ImageBlobFetchError('http', error.message, details)
  }
  return new ImageBlobFetchError('network', error.message, details)
}

async function fetchApiImageBlob(
  candidate: Extract<ImageCandidate, { acquisitionMethod: 'api' }>,
  dimensions: { width: number; height: number },
  dependencies: ImageBlobClientDependencies,
): Promise<FetchedImageBlob> {
  let image: ProxiedImage
  try {
    image = await (dependencies.fetchProxiedImage ?? fetchProxiedImage)(candidate.proxyToken)
  } catch (error) {
    if (error instanceof AcquisitionApiClientError) {
      throw toApiImageFetchError(error, candidate)
    }
    throw new ImageBlobFetchError('network', '中継画像の取得中にエラーが発生しました。', {
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
    })
  }

  return {
    candidateId: candidate.id,
    domOrder: candidate.domOrder,
    blob: image.blob,
    sourceUrl: candidate.imageUrl,
    mimeType: image.mimeType,
    fileSize: image.fileSize,
    width: dimensions.width,
    height: dimensions.height,
  }
}

export async function fetchImageBlob(
  candidate: ImageCandidate,
  dependencies: ImageBlobClientDependencies = defaultDependencies,
): Promise<FetchedImageBlob> {
  if (candidate.width === undefined || candidate.height === undefined) {
    throw new ImageBlobFetchError('missingDimensions', '画像の幅と高さを取得できませんでした。', {
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
    })
  }

  if (candidate.acquisitionMethod === 'api') {
    return fetchApiImageBlob(
      candidate,
      { width: candidate.width, height: candidate.height },
      dependencies,
    )
  }

  let response: Response

  try {
    response = await dependencies.fetch(candidate.imageUrl)
  } catch {
    throw new ImageBlobFetchError('network', '画像へ接続できませんでした。', {
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
    })
  }

  if (!response.ok) {
    throw new ImageBlobFetchError(
      'http',
      `画像の取得に失敗しました。HTTPステータス: ${response.status}`,
      {
        candidateId: candidate.id,
        imageUrl: candidate.imageUrl,
        status: response.status,
      },
    )
  }

  const contentType = response.headers.get('content-type') ?? ''
  const mimeType = getImageMediaType(contentType)
  if (mimeType === undefined) {
    throw new ImageBlobFetchError(
      'unsupportedContentType',
      '取得したデータは画像ではありません。',
      {
        candidateId: candidate.id,
        imageUrl: candidate.imageUrl,
        contentType,
      },
    )
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch {
    throw new ImageBlobFetchError('network', '画像データの読み込みに失敗しました。', {
      candidateId: candidate.id,
      imageUrl: candidate.imageUrl,
    })
  }

  return {
    candidateId: candidate.id,
    domOrder: candidate.domOrder,
    blob,
    sourceUrl: candidate.imageUrl,
    mimeType,
    fileSize: blob.size,
    width: candidate.width,
    height: candidate.height,
  }
}

export async function fetchSelectedImageBlobs(
  candidates: readonly ImageCandidate[],
  dependencies: ImageBlobClientDependencies = defaultDependencies,
): Promise<ImageBlobBatchFetchResult> {
  const selectedCandidates = candidates.filter(({ isSelected }) => isSelected)
  const results = await Promise.all(
    selectedCandidates.map(async (candidate) => {
      try {
        return { image: await fetchImageBlob(candidate, dependencies) }
      } catch (error) {
        if (error instanceof ImageBlobFetchError) {
          return { error }
        }
        return {
          error: new ImageBlobFetchError('network', '画像の取得中にエラーが発生しました。', {
            candidateId: candidate.id,
            imageUrl: candidate.imageUrl,
          }),
        }
      }
    }),
  )

  const images = results.flatMap((result) => (result.image === undefined ? [] : [result.image]))
  const failures = results.flatMap((result) => (result.error === undefined ? [] : [result.error]))

  if (failures.length === 0) {
    return { status: 'success', images, failures: [] }
  }
  if (images.length === 0) {
    return { status: 'failure', images: [], failures }
  }
  return { status: 'partial-failure', images, failures }
}

export function createSelectedImageBlobFetcher(
  dependencies: ImageBlobClientDependencies = defaultDependencies,
): (candidates: readonly ImageCandidate[]) => Promise<ImageBlobBatchFetchResult> {
  const fetchedImages = new Map<string, FetchedImageBlob>()

  return async (candidates) => {
    const selectedCandidates = candidates.filter(({ isSelected }) => isSelected)
    const uncachedCandidates = selectedCandidates.filter(({ id }) => !fetchedImages.has(id))
    const result = await fetchSelectedImageBlobs(uncachedCandidates, dependencies)
    for (const image of result.images) {
      fetchedImages.set(image.candidateId, image)
    }

    const images = selectedCandidates.flatMap((candidate) => {
      const image = fetchedImages.get(candidate.id)
      return image === undefined ? [] : [image]
    })
    if (result.failures.length === 0) {
      return { status: 'success', images, failures: [] }
    }
    if (images.length === 0) {
      return { status: 'failure', images: [], failures: result.failures }
    }
    return { status: 'partial-failure', images, failures: result.failures }
  }
}
