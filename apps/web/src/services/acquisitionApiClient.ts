import {
  parseAcquisitionApiErrorResponse,
  parsePageAnalysisResponse,
  type PageAnalysisResponse,
} from './acquisitionApiSchemas'
import { ImageBlobFetchError } from './imageBlobClient'
import type { ImageCandidate } from './imageCandidateFactory'
import { PageHtmlFetchError } from './pageHtmlClient'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

export type AcquisitionApiClientErrorKind =
  | 'api'
  | 'invalidResponse'
  | 'network'
  | 'unsupportedContentType'

export interface AcquisitionApiClientErrorDetails {
  status?: number
  code?: string
  retryable?: boolean
  contentType?: string
  apiDetails?: Record<string, string | number | boolean>
}

export class AcquisitionApiClientError extends Error {
  readonly kind: AcquisitionApiClientErrorKind
  readonly status?: number
  readonly code?: string
  readonly retryable?: boolean
  readonly contentType?: string
  readonly apiDetails?: Record<string, string | number | boolean>

  constructor(
    kind: AcquisitionApiClientErrorKind,
    message: string,
    details: AcquisitionApiClientErrorDetails = {},
  ) {
    super(message)
    this.name = 'AcquisitionApiClientError'
    this.kind = kind
    this.status = details.status
    this.code = details.code
    this.retryable = details.retryable
    this.contentType = details.contentType
    this.apiDetails = details.apiDetails
  }
}

export interface AcquisitionApiClientDependencies {
  fetch: typeof fetch
  apiBaseUrl: string
}

const defaultDependencies: AcquisitionApiClientDependencies = {
  fetch: (input, init) => globalThis.fetch(input, init),
  apiBaseUrl: import.meta.env.VITE_FETCH_API_BASE_URL ?? DEFAULT_API_BASE_URL,
}

function createApiUrl(path: string, apiBaseUrl: string): URL {
  const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`
  return new URL(path, baseUrl)
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new AcquisitionApiClientError(
      'invalidResponse',
      'APIからJSON形式ではないレスポンスが返されました。',
      { status: response.status },
    )
  }
}

async function throwApiError(response: Response): Promise<never> {
  const payload = await readJson(response)
  const parsed = parseAcquisitionApiErrorResponse(payload)
  if (parsed === undefined) {
    throw new AcquisitionApiClientError(
      'invalidResponse',
      'APIエラーレスポンスの形式が不正です。',
      { status: response.status },
    )
  }

  throw new AcquisitionApiClientError('api', parsed.error.message, {
    status: response.status,
    code: parsed.error.code,
    retryable: parsed.error.retryable,
    apiDetails: parsed.error.details ?? undefined,
  })
}

export async function analyzePageViaApi(
  pageUrl: string,
  dependencies: AcquisitionApiClientDependencies = defaultDependencies,
): Promise<PageAnalysisResponse> {
  let response: Response
  try {
    response = await dependencies.fetch(createApiUrl('v1/pages/analyze', dependencies.apiBaseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: pageUrl }),
    })
  } catch {
    throw new AcquisitionApiClientError('network', 'ページ解析APIへ接続できませんでした。')
  }

  if (!response.ok) {
    return throwApiError(response)
  }

  const payload = await readJson(response)
  const parsed = parsePageAnalysisResponse(payload)
  if (parsed === undefined) {
    throw new AcquisitionApiClientError(
      'invalidResponse',
      'ページ解析APIのレスポンス形式が不正です。',
      { status: response.status },
    )
  }
  return parsed
}

export interface ProxiedImage {
  blob: Blob
  mimeType: string
  fileSize: number
}

export async function fetchProxiedImage(
  proxyToken: string,
  dependencies: AcquisitionApiClientDependencies = defaultDependencies,
): Promise<ProxiedImage> {
  const url = createApiUrl('v1/images/proxy', dependencies.apiBaseUrl)
  url.searchParams.set('token', proxyToken)

  let response: Response
  try {
    response = await dependencies.fetch(url)
  } catch {
    throw new AcquisitionApiClientError('network', '画像中継APIへ接続できませんでした。')
  }

  if (!response.ok) {
    return throwApiError(response)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const mimeType = contentType.split(';', 1)[0]?.trim().toLowerCase()
  if (mimeType === undefined || !mimeType.startsWith('image/')) {
    throw new AcquisitionApiClientError(
      'unsupportedContentType',
      '画像中継APIから画像以外のデータが返されました。',
      { status: response.status, contentType },
    )
  }

  let blob: Blob
  try {
    blob = await response.blob()
  } catch {
    throw new AcquisitionApiClientError('network', '中継画像データを読み込めませんでした。')
  }

  return { blob, mimeType, fileSize: blob.size }
}

export function toPageHtmlFetchError(error: AcquisitionApiClientError): PageHtmlFetchError {
  if (error.kind === 'unsupportedContentType' || error.code === 'unsupported_content_type') {
    return new PageHtmlFetchError('unsupportedContentType', error.message, {
      contentType: error.contentType,
    })
  }
  if (error.kind === 'network' || error.kind === 'invalidResponse') {
    return new PageHtmlFetchError('network', error.message)
  }
  return new PageHtmlFetchError('http', error.message, { status: error.status })
}

export function toImageBlobFetchError(
  error: AcquisitionApiClientError,
  candidate: Pick<ImageCandidate, 'id' | 'imageUrl'>,
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
  if (error.kind === 'network' || error.kind === 'invalidResponse') {
    return new ImageBlobFetchError('network', error.message, details)
  }
  return new ImageBlobFetchError('http', error.message, details)
}
