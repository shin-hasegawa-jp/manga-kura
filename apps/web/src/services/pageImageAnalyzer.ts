import { validatePageUrl, type PageUrlValidation } from '@/views/savePageUrlValidation'
import { analyzePageViaApi } from './acquisitionApiClient'
import type { ApiImageCandidate } from './acquisitionApiSchemas'
import { createApiImageCandidates, type ImageCandidate } from './imageCandidateFactory'
import { scoreAndSelectImageCandidates } from './imageCandidateScorer'

export type PageImageAnalysisFailureKind = 'invalid-url' | 'html-fetch-failed' | 'analysis-failed'

export type PageImageAnalysisState =
  | { status: 'analyzing' }
  | {
      status: 'success'
      pageUrl: string
      candidates: ImageCandidate[]
    }
  | { status: 'empty'; pageUrl: string }
  | {
      status: 'failure'
      kind: PageImageAnalysisFailureKind
      message: string
      cause?: unknown
    }

export interface PageImageAnalyzerDependencies {
  validateUrl(input: string): PageUrlValidation
  analyzeViaApi(pageUrl: string): Promise<{ candidates: ApiImageCandidate[] }>
  createApiCandidates(candidates: readonly ApiImageCandidate[]): ImageCandidate[]
  scoreCandidates(candidates: readonly ImageCandidate[]): ImageCandidate[]
}

const defaultDependencies: PageImageAnalyzerDependencies = {
  validateUrl: validatePageUrl,
  analyzeViaApi: analyzePageViaApi,
  createApiCandidates: createApiImageCandidates,
  scoreCandidates: scoreAndSelectImageCandidates,
}

function getFailureMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

async function acquireCandidates(
  pageUrl: string,
  dependencies: PageImageAnalyzerDependencies,
): Promise<ImageCandidate[]> {
  const response = await dependencies.analyzeViaApi(pageUrl)
  return dependencies.createApiCandidates(response.candidates)
}

export async function analyzePageImages(
  input: string,
  dependencies: PageImageAnalyzerDependencies = defaultDependencies,
  onStateChange: (state: PageImageAnalysisState) => void = () => undefined,
): Promise<PageImageAnalysisState> {
  onStateChange({ status: 'analyzing' })

  const validation = dependencies.validateUrl(input)
  if (validation.status === 'invalid') {
    const state: PageImageAnalysisState = {
      status: 'failure',
      kind: 'invalid-url',
      message: validation.message,
    }
    onStateChange(state)
    return state
  }

  let candidates: ImageCandidate[]
  try {
    candidates = await acquireCandidates(validation.url, dependencies)
  } catch (cause) {
    const state: PageImageAnalysisState = {
      status: 'failure',
      kind: 'html-fetch-failed',
      message: getFailureMessage(cause, 'ページの取得に失敗しました。'),
      cause,
    }
    onStateChange(state)
    return state
  }

  try {
    if (candidates.length === 0) {
      const state: PageImageAnalysisState = {
        status: 'empty',
        pageUrl: validation.url,
      }
      onStateChange(state)
      return state
    }

    const scoredCandidates = dependencies.scoreCandidates(candidates)
    const state: PageImageAnalysisState = {
      status: 'success',
      pageUrl: validation.url,
      candidates: scoredCandidates,
    }
    onStateChange(state)
    return state
  } catch (cause) {
    const state: PageImageAnalysisState = {
      status: 'failure',
      kind: 'analysis-failed',
      message: getFailureMessage(cause, '画像候補の解析に失敗しました。'),
      cause,
    }
    onStateChange(state)
    return state
  }
}
