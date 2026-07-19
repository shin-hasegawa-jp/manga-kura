import type { PageUrlValidation } from '@/views/savePageUrlValidation'
import { describe, expect, it, vi } from 'vitest'
import { AcquisitionApiClientError } from '../acquisitionApiClient'
import type { ApiImageCandidate } from '../acquisitionApiSchemas'
import { createApiImageCandidates, type ImageCandidate } from '../imageCandidateFactory'
import {
  analyzePageImages,
  type PageImageAnalysisState,
  type PageImageAnalyzerDependencies,
} from '../pageImageAnalyzer'

const pageUrl = 'https://example.com/comic/'

function createApiCandidate(): ApiImageCandidate {
  return {
    id: 'image-candidate-0',
    domOrder: 0,
    imageUrl: 'https://cdn.example.com/page01.jpg',
    sourceAttribute: 'src',
    proxyToken: 'signed-token',
    previewToken: 'preview-token',
  }
}

function createDependencies(
  overrides: Partial<PageImageAnalyzerDependencies> = {},
): PageImageAnalyzerDependencies {
  return {
    validateUrl: vi.fn((): PageUrlValidation => ({ status: 'valid', url: pageUrl })),
    analyzeViaApi: vi.fn(async () => ({ candidates: [createApiCandidate()] })),
    createApiCandidates: vi.fn(createApiImageCandidates),
    scoreCandidates: vi.fn((candidates: readonly ImageCandidate[]): ImageCandidate[] =>
      candidates.map((candidate) => ({
        ...candidate,
        score: 75,
        selectionReasons: ['large-image', 'portrait-aspect-ratio'],
        isSelected: true,
      })),
    ),
    ...overrides,
  }
}

describe('ページ画像解析フロー', () => {
  it('URL検証後に解析APIを1回だけ呼び、候補生成とデフォルト選択を行う', async () => {
    const calls: string[] = []
    const dependencies = createDependencies({
      validateUrl: vi.fn((): PageUrlValidation => {
        calls.push('validate')
        return { status: 'valid', url: pageUrl }
      }),
      analyzeViaApi: vi.fn(async (url) => {
        calls.push('api')
        expect(url).toBe(pageUrl)
        return { candidates: [createApiCandidate()] }
      }),
      createApiCandidates: vi.fn((candidates) => {
        calls.push('create')
        return createApiImageCandidates(candidates)
      }),
      scoreCandidates: vi.fn((candidates) => {
        calls.push('score')
        return [...candidates]
      }),
    })
    const states: PageImageAnalysisState[] = []

    await expect(
      analyzePageImages(' https://example.com/comic ', dependencies, (state) => states.push(state)),
    ).resolves.toEqual({
      status: 'success',
      pageUrl,
      acquisitionMethod: 'api',
      candidates: [
        expect.objectContaining({
          id: 'image-candidate-0',
          acquisitionMethod: 'api',
          proxyToken: 'signed-token',
          previewToken: 'preview-token',
        }),
      ],
    })
    expect(calls).toEqual(['validate', 'api', 'create', 'score'])
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
    expect(states.map(({ status }) => status)).toEqual(['analyzing', 'success'])
  })

  it('解析APIの候補がない場合は空状態にして候補生成以降を実行しない', async () => {
    const dependencies = createDependencies({
      analyzeViaApi: vi.fn(async () => ({ candidates: [] })),
    })

    await expect(analyzePageImages(pageUrl, dependencies)).resolves.toEqual({
      status: 'empty',
      pageUrl,
      acquisitionMethod: 'api',
    })
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
    expect(dependencies.createApiCandidates).toHaveBeenCalledOnce()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('URL検証失敗時は解析APIを呼び出さない', async () => {
    const dependencies = createDependencies({
      validateUrl: vi.fn(
        (): PageUrlValidation => ({ status: 'invalid', message: 'URLが不正です。' }),
      ),
    })

    await expect(analyzePageImages('invalid', dependencies)).resolves.toEqual({
      status: 'failure',
      kind: 'invalid-url',
      message: 'URLが不正です。',
    })
    expect(dependencies.analyzeViaApi).not.toHaveBeenCalled()
    expect(dependencies.createApiCandidates).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it.each([
    ['通信失敗', new AcquisitionApiClientError('network', '解析APIに接続できません。')],
    [
      'APIエラー',
      new AcquisitionApiClientError('api', '取得先がタイムアウトしました。', {
        status: 504,
        code: 'upstream_timeout',
      }),
    ],
    [
      '不正レスポンス',
      new AcquisitionApiClientError('invalidResponse', 'レスポンス形式が不正です。', {
        status: 200,
      }),
    ],
  ])('解析APIの%sを失敗状態として返し、再試行しない', async (_caseName, apiError) => {
    const dependencies = createDependencies({
      analyzeViaApi: vi.fn().mockRejectedValue(apiError),
    })

    await expect(analyzePageImages(pageUrl, dependencies)).resolves.toEqual({
      status: 'failure',
      kind: 'html-fetch-failed',
      message: apiError.message,
      cause: apiError,
    })
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
    expect(dependencies.createApiCandidates).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('候補変換失敗時も解析APIを再実行しない', async () => {
    const conversionError = new Error('候補を変換できません。')
    const dependencies = createDependencies({
      createApiCandidates: vi.fn(() => {
        throw conversionError
      }),
    })
    const statuses: PageImageAnalysisState['status'][] = []

    await expect(
      analyzePageImages(pageUrl, dependencies, (state) => statuses.push(state.status)),
    ).resolves.toEqual({
      status: 'failure',
      kind: 'html-fetch-failed',
      message: conversionError.message,
      cause: conversionError,
    })
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
    expect(statuses).toEqual(['analyzing', 'failure'])
  })

  it('候補のスコアリング失敗時は解析失敗を返す', async () => {
    const scoreError = new Error('スコアリングに失敗しました。')
    const dependencies = createDependencies({
      scoreCandidates: vi.fn(() => {
        throw scoreError
      }),
    })

    await expect(analyzePageImages(pageUrl, dependencies)).resolves.toEqual({
      status: 'failure',
      kind: 'analysis-failed',
      message: scoreError.message,
      cause: scoreError,
    })
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
  })
})
