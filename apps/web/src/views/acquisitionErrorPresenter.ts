import type { ImageBlobFetchError } from '@/services/imageBlobClient'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import type { PageImageAnalysisState } from '@/services/pageImageAnalyzer'
import { PageHtmlFetchError } from '@/services/pageHtmlClient'
import type { SaveAnalyzedPageResult } from './saveAnalyzedPage'

export interface AcquisitionErrorPresentation {
  message: string
  canRetry: boolean
}

type PageAnalysisProblemState = Extract<PageImageAnalysisState, { status: 'failure' | 'empty' }>

export function getPageAnalysisErrorPresentation(
  state: PageAnalysisProblemState,
): AcquisitionErrorPresentation {
  if (state.status === 'empty') {
    return {
      message: 'このページから画像候補を抽出できませんでした。URLを確認して再解析できます。',
      canRetry: true,
    }
  }

  if (state.kind === 'invalid-url') {
    return { message: state.message, canRetry: true }
  }

  if (state.cause instanceof PageHtmlFetchError) {
    switch (state.cause.kind) {
      case 'network':
        return {
          message:
            'ページへ接続できませんでした。サイトのCORS設定または通信状態を確認して再試行してください。',
          canRetry: true,
        }
      case 'http':
        return {
          message: `ページの取得に失敗しました（HTTP ${state.cause.status ?? 'エラー'}）。URLを確認して再試行してください。`,
          canRetry: true,
        }
      case 'unsupportedContentType':
        return {
          message: `取得先はHTMLではありません（${state.cause.contentType || 'Content-Type不明'}）。HTMLページのURLを入力してください。`,
          canRetry: true,
        }
    }
  }

  return { message: state.message || '画像候補の解析に失敗しました。', canRetry: true }
}

function getImageFailureLabel(
  failure: ImageBlobFetchError,
  candidates: readonly ImageCandidate[],
): string {
  const candidate = candidates.find(({ id }) => id === failure.candidateId)
  const candidateLabel = candidate
    ? `候補 ${candidate.domOrder + 1}`
    : `候補 ${failure.candidateId}`

  switch (failure.kind) {
    case 'http':
      return `${candidateLabel}（HTTP ${failure.status ?? 'エラー'}）`
    case 'network':
      return `${candidateLabel}（通信またはCORSエラー）`
    case 'unsupportedContentType':
      return `${candidateLabel}（画像以外のContent-Type）`
    case 'missingDimensions':
      return `${candidateLabel}（画像サイズ取得失敗）`
  }
}

export function getSaveErrorPresentation(
  result: Extract<SaveAnalyzedPageResult, { status: 'error' }>,
  candidates: readonly ImageCandidate[],
): AcquisitionErrorPresentation {
  if (result.kind !== 'image-fetch-failed') {
    return { message: result.message, canRetry: true }
  }

  const failedLabels = result.failures.map((failure) => getImageFailureLabel(failure, candidates))
  return {
    message: `${failedLabels.join('、')}を取得できなかったため保存を中断しました。選択内容を保持したまま再試行できます。`,
    canRetry: true,
  }
}

export function markImageFetchFailures(
  candidates: readonly ImageCandidate[],
  failures: readonly ImageBlobFetchError[],
): ImageCandidate[] {
  const failedCandidateIds = new Set(failures.map(({ candidateId }) => candidateId))
  return candidates.map((candidate) =>
    failedCandidateIds.has(candidate.id) ? { ...candidate, fetchStatus: 'failed' } : candidate,
  )
}
