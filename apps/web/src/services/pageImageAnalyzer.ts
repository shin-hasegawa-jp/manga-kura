import { validatePageUrl, type PageUrlValidation } from '@/views/savePageUrlValidation'
import { analyzePageViaApi } from './acquisitionApiClient'
import type { ApiImageCandidate } from './acquisitionApiSchemas'
import {
  createApiImageCandidates,
  createImageCandidates,
  type ImageCandidate,
} from './imageCandidateFactory'
import { scoreAndSelectImageCandidates } from './imageCandidateScorer'
import { loadImageCandidateDimensions } from './imageDimensionLoader'
import { fetchPageHtml, PageHtmlFetchError } from './pageHtmlClient'

export type PageImageAnalysisFailureKind = 'invalid-url' | 'html-fetch-failed' | 'analysis-failed'

export type PageImageAnalysisState =
  | { status: 'analyzing' }
  | {
      status: 'success'
      pageUrl: string
      acquisitionMethod: 'direct' | 'api'
      candidates: ImageCandidate[]
    }
  | { status: 'empty'; pageUrl: string; acquisitionMethod: 'direct' | 'api' }
  | {
      status: 'failure'
      kind: PageImageAnalysisFailureKind
      message: string
      cause?: unknown
    }

export interface PageImageAnalyzerDependencies {
  validateUrl(input: string): PageUrlValidation
  fetchHtml(pageUrl: string): Promise<string>
  analyzeViaApi(pageUrl: string): Promise<{ candidates: ApiImageCandidate[] }>
  createCandidates(html: string, pageUrl: string): ImageCandidate[]
  createApiCandidates(candidates: readonly ApiImageCandidate[]): ImageCandidate[]
  loadDimensions(candidates: readonly ImageCandidate[]): Promise<ImageCandidate[]>
  scoreCandidates(candidates: readonly ImageCandidate[]): ImageCandidate[]
}

const defaultDependencies: PageImageAnalyzerDependencies = {
  validateUrl: validatePageUrl,
  fetchHtml: fetchPageHtml,
  analyzeViaApi: analyzePageViaApi,
  createCandidates: createImageCandidates,
  createApiCandidates: createApiImageCandidates,
  loadDimensions: loadImageCandidateDimensions,
  scoreCandidates: scoreAndSelectImageCandidates,
}

function getFailureMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}

function isDirectFetchFallbackTarget(cause: unknown): boolean {
  return cause instanceof PageHtmlFetchError && cause.kind === 'network'
}

async function acquireCandidates(
  pageUrl: string,
  dependencies: PageImageAnalyzerDependencies,
): Promise<{ acquisitionMethod: 'direct' | 'api'; candidates: ImageCandidate[] }> {
  try {
    const html = await dependencies.fetchHtml(pageUrl)
    return {
      acquisitionMethod: 'direct',
      candidates: dependencies.createCandidates(html, pageUrl),
    }
  } catch (cause) {
    if (!isDirectFetchFallbackTarget(cause)) {
      throw cause
    }

    const response = await dependencies.analyzeViaApi(pageUrl)
    return {
      acquisitionMethod: 'api',
      candidates: dependencies.createApiCandidates(response.candidates),
    }
  }
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

  let acquisition: Awaited<ReturnType<typeof acquireCandidates>>
  try {
    acquisition = await acquireCandidates(validation.url, dependencies)
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
    if (acquisition.candidates.length === 0) {
      const state: PageImageAnalysisState = {
        status: 'empty',
        pageUrl: validation.url,
        acquisitionMethod: acquisition.acquisitionMethod,
      }
      onStateChange(state)
      return state
    }

    const candidatesWithDimensions =
      acquisition.acquisitionMethod === 'api'
        ? acquisition.candidates
        : await dependencies.loadDimensions(acquisition.candidates)
    const scoredCandidates = dependencies.scoreCandidates(candidatesWithDimensions)
    const state: PageImageAnalysisState = {
      status: 'success',
      pageUrl: validation.url,
      acquisitionMethod: acquisition.acquisitionMethod,
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
