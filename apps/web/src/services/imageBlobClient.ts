import type { ImageCandidate } from './imageCandidateFactory'

export type ImageBlobFetchErrorKind = 'http' | 'network' | 'unsupportedContentType'

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
  width?: number
  height?: number
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
}

function getImageMediaType(contentType: string): string | undefined {
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  return mediaType?.startsWith('image/') ? mediaType : undefined
}

export async function fetchImageBlob(
  candidate: ImageCandidate,
  dependencies: ImageBlobClientDependencies = { fetch },
): Promise<FetchedImageBlob> {
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
  dependencies: ImageBlobClientDependencies = { fetch },
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
