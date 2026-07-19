import { describe, expect, it } from 'vitest'
import { AcquisitionApiClientError } from '@/services/acquisitionApiClient'
import { ImageBlobFetchError, type ImageBlobFetchErrorKind } from '@/services/imageBlobClient'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import {
  getPageAnalysisErrorPresentation,
  getSaveErrorPresentation,
  markImageFetchFailures,
} from '../acquisitionErrorPresenter'

function createCandidate(id: string, domOrder: number): ImageCandidate {
  return {
    id,
    domOrder,
    imageUrl: `https://example.com/images/page${domOrder + 1}.jpg`,
    sourceAttribute: 'src',
    isSelected: true,
    score: 90,
    selectionReasons: ['sequential-filename'],
    fetchStatus: 'loaded',
    proxyToken: `proxy-token-${id}`,
    previewToken: `preview-token-${id}`,
    width: 800,
    height: 1200,
  }
}

describe('取得失敗のエラー表示', () => {
  it('不正URLの検証メッセージを表示する', () => {
    expect(
      getPageAnalysisErrorPresentation({
        status: 'failure',
        kind: 'invalid-url',
        message: '有効な絶対URLを入力してください。',
      }),
    ).toEqual({ message: '有効な絶対URLを入力してください。', canRetry: true })
  })

  it.each([
    [
      '通信失敗',
      new AcquisitionApiClientError('network', '通信失敗'),
      'ページ解析APIへ接続できませんでした',
    ],
    [
      'APIエラー',
      new AcquisitionApiClientError('api', '取得先でエラーが発生しました。', {
        status: 404,
        retryable: true,
      }),
      'HTTP 404',
    ],
    [
      '対応していない形式',
      new AcquisitionApiClientError('unsupportedContentType', '形式不一致', {
        contentType: 'application/json',
      }),
      '対応していない形式が返されました（application/json）',
    ],
    [
      '不正レスポンス',
      new AcquisitionApiClientError('invalidResponse', '形式不正'),
      '不正なレスポンス',
    ],
  ])('%sを原因別の文言へ変換する', (_caseName, cause, expectedMessage) => {
    expect(
      getPageAnalysisErrorPresentation({
        status: 'failure',
        kind: 'api-analysis-failed',
        message: cause.message,
        cause,
      }),
    ).toEqual(expect.objectContaining({ message: expect.stringContaining(expectedMessage) }))
  })

  it('再試行できないAPIエラーでは再試行不可として表示する', () => {
    const cause = new AcquisitionApiClientError('api', 'URLが許可されていません。', {
      status: 400,
      retryable: false,
    })

    expect(
      getPageAnalysisErrorPresentation({
        status: 'failure',
        kind: 'api-analysis-failed',
        message: cause.message,
        cause,
      }),
    ).toEqual({ message: 'URLが許可されていません。（HTTP 400）', canRetry: false })
  })

  it('候補なしを再解析可能な空状態として表示する', () => {
    expect(
      getPageAnalysisErrorPresentation({
        status: 'empty',
        pageUrl: 'https://example.com/',
      }),
    ).toEqual({
      message: 'このページから画像候補を抽出できませんでした。URLを確認して再解析できます。',
      canRetry: true,
    })
  })

  it('画像取得失敗の候補番号と原因を表示する', () => {
    const candidates = [createCandidate('candidate-1', 0), createCandidate('candidate-2', 1)]
    const failures = [
      new ImageBlobFetchError('http', '取得失敗', {
        candidateId: 'candidate-2',
        imageUrl: candidates[1]?.imageUrl ?? '',
        status: 403,
      }),
    ]

    expect(
      getSaveErrorPresentation(
        {
          status: 'error',
          kind: 'image-fetch-failed',
          message: '画像取得失敗',
          failures,
        },
        candidates,
      ),
    ).toEqual({
      message:
        '候補 2（画像中継API HTTP 403）を取得できなかったため保存を中断しました。選択内容を保持したまま再試行できます。',
      canRetry: true,
    })
  })

  const imageFailureCases: [ImageBlobFetchErrorKind, undefined, string][] = [
    ['network', undefined, '画像中継APIの通信エラー'],
    ['unsupportedContentType', undefined, '画像中継APIから画像以外のデータを受信'],
    ['missingDimensions', undefined, '画像サイズ取得失敗'],
  ]

  it.each(imageFailureCases)(
    '画像の%sエラーを候補番号付きで表示する',
    (kind, status, expectedReason) => {
      const candidate = createCandidate('candidate-1', 0)
      const failure = new ImageBlobFetchError(kind, '取得失敗', {
        candidateId: candidate.id,
        imageUrl: candidate.imageUrl,
        status,
      })
      const result = getSaveErrorPresentation(
        {
          status: 'error',
          kind: 'image-fetch-failed',
          message: '画像取得失敗',
          failures: [failure],
        },
        [candidate],
      )

      expect(result.message).toContain(`候補 1（${expectedReason}）`)
    },
  )

  it('取得に失敗した候補だけを失敗状態へ更新する', () => {
    const candidates = [createCandidate('candidate-1', 0), createCandidate('candidate-2', 1)]
    const failure = new ImageBlobFetchError('network', '取得失敗', {
      candidateId: 'candidate-2',
      imageUrl: candidates[1]?.imageUrl ?? '',
    })

    expect(
      markImageFetchFailures(candidates, [failure]).map(({ fetchStatus }) => fetchStatus),
    ).toEqual(['loaded', 'failed'])
  })
})
