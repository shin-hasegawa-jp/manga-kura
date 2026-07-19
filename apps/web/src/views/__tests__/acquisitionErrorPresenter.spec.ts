import { describe, expect, it } from 'vitest'
import { ImageBlobFetchError, type ImageBlobFetchErrorKind } from '@/services/imageBlobClient'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import { PageHtmlFetchError } from '@/services/pageHtmlClient'
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
    ['通信・CORS失敗', new PageHtmlFetchError('network', '通信失敗'), 'CORS設定または通信状態'],
    ['HTTPエラー', new PageHtmlFetchError('http', 'HTTP失敗', { status: 404 }), 'HTTP 404'],
    [
      'HTML以外',
      new PageHtmlFetchError('unsupportedContentType', '形式不一致', {
        contentType: 'application/json',
      }),
      'HTMLではありません（application/json）',
    ],
  ])('%sを原因別の文言へ変換する', (_caseName, cause, expectedMessage) => {
    expect(
      getPageAnalysisErrorPresentation({
        status: 'failure',
        kind: 'html-fetch-failed',
        message: cause.message,
        cause,
      }),
    ).toEqual(expect.objectContaining({ message: expect.stringContaining(expectedMessage) }))
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
        '候補 2（HTTP 403）を取得できなかったため保存を中断しました。選択内容を保持したまま再試行できます。',
      canRetry: true,
    })
  })

  const imageFailureCases: [ImageBlobFetchErrorKind, undefined, string][] = [
    ['network', undefined, '通信またはCORSエラー'],
    ['unsupportedContentType', undefined, '画像以外のContent-Type'],
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
