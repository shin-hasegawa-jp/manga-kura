import { validatePageUrl, type PageUrlValidation } from '@/views/savePageUrlValidation'
import { createImageCandidates, type ImageCandidate } from './imageCandidateFactory'
import { scoreAndSelectImageCandidates } from './imageCandidateScorer'
import { loadImageCandidateDimensions } from './imageDimensionLoader'
import { fetchPageHtml } from './pageHtmlClient'

export type PageImageAnalysisFailureKind = 'invalid-url' | 'html-fetch-failed' | 'analysis-failed'

export type PageImageAnalysisState =
  | { status: 'analyzing' }
  | { status: 'success'; pageUrl: string; candidates: ImageCandidate[] }
  | { status: 'empty'; pageUrl: string }
  | {
      status: 'failure'
      kind: PageImageAnalysisFailureKind
      message: string
      cause?: unknown
    }

export interface PageImageAnalyzerDependencies {
  validateUrl(input: string): PageUrlValidation
  fetchHtml(pageUrl: string): Promise<string>
  createCandidates(html: string, pageUrl: string): ImageCandidate[]
  loadDimensions(candidates: readonly ImageCandidate[]): Promise<ImageCandidate[]>
  scoreCandidates(candidates: readonly ImageCandidate[]): ImageCandidate[]
}

const defaultDependencies: PageImageAnalyzerDependencies = {
  validateUrl: validatePageUrl,
  fetchHtml: fetchPageHtml,
  createCandidates: createImageCandidates,
  loadDimensions: loadImageCandidateDimensions,
  scoreCandidates: scoreAndSelectImageCandidates,
}

function getFailureMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
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

  let html: string
  try {
    html = await dependencies.fetchHtml(validation.url)
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
    const candidates = dependencies.createCandidates(html, validation.url)
    if (candidates.length === 0) {
      const state: PageImageAnalysisState = { status: 'empty', pageUrl: validation.url }
      onStateChange(state)
      return state
    }

    const candidatesWithDimensions = await dependencies.loadDimensions(candidates)
    const scoredCandidates = dependencies.scoreCandidates(candidatesWithDimensions)
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
