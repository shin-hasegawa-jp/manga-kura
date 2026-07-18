export type PageHtmlFetchErrorKind = 'http' | 'network' | 'unsupportedContentType'

export interface PageHtmlFetchErrorDetails {
  status?: number
  contentType?: string
}

export class PageHtmlFetchError extends Error {
  readonly kind: PageHtmlFetchErrorKind
  readonly status?: number
  readonly contentType?: string

  constructor(
    kind: PageHtmlFetchErrorKind,
    message: string,
    details: PageHtmlFetchErrorDetails = {},
  ) {
    super(message)
    this.name = 'PageHtmlFetchError'
    this.kind = kind
    this.status = details.status
    this.contentType = details.contentType
  }
}

export interface PageHtmlClientDependencies {
  fetch: typeof fetch
}

const defaultDependencies: PageHtmlClientDependencies = {
  fetch: (input, init) => globalThis.fetch(input, init),
}

function isHtmlContentType(contentType: string): boolean {
  const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()

  return mediaType === 'text/html' || mediaType === 'application/xhtml+xml'
}

export async function fetchPageHtml(
  url: string,
  dependencies: PageHtmlClientDependencies = defaultDependencies,
): Promise<string> {
  let response: Response

  try {
    response = await dependencies.fetch(url)
  } catch {
    throw new PageHtmlFetchError(
      'network',
      'ページへ接続できませんでした。CORS設定または通信状態を確認してください。',
    )
  }

  if (!response.ok) {
    throw new PageHtmlFetchError(
      'http',
      `ページの取得に失敗しました。HTTPステータス: ${response.status}`,
      { status: response.status },
    )
  }

  const contentType = response.headers.get('content-type') ?? ''

  if (!isHtmlContentType(contentType)) {
    throw new PageHtmlFetchError(
      'unsupportedContentType',
      '取得したレスポンスはHTMLではありません。',
      { contentType },
    )
  }

  try {
    return await response.text()
  } catch {
    throw new PageHtmlFetchError(
      'network',
      'ページの本文を読み込めませんでした。通信状態を確認してください。',
    )
  }
}
