import { describe, expect, it, vi } from 'vitest'
import type { ImageCandidate } from '../imageCandidateFactory'
import { createApiImageCandidates } from '../imageCandidateFactory'
import type { ApiImageCandidate } from '../acquisitionApiSchemas'
import { PageHtmlFetchError } from '../pageHtmlClient'
import type { PageUrlValidation } from '@/views/savePageUrlValidation'
import {
  analyzePageImages,
  type PageImageAnalysisState,
  type PageImageAnalyzerDependencies,
} from '../pageImageAnalyzer'

function createCandidate(id: string, imageUrl: string): ImageCandidate {
  return {
    id,
    domOrder: Number(id),
    imageUrl,
    sourceAttribute: 'src',
    isSelected: false,
    score: 0,
    selectionReasons: [],
    fetchStatus: 'idle',
    acquisitionMethod: 'direct',
  }
}

function createDependencies(
  overrides: Partial<PageImageAnalyzerDependencies> = {},
): PageImageAnalyzerDependencies {
  return {
    validateUrl: vi.fn(
      (): PageUrlValidation => ({ status: 'valid', url: 'https://example.com/comic/' }),
    ),
    fetchHtml: vi.fn(async () => '<img src="page01.jpg">'),
    analyzeViaApi: vi.fn(async () => ({ candidates: [] })),
    createCandidates: vi.fn(() => [createCandidate('0', 'https://example.com/comic/page01.jpg')]),
    createApiCandidates: vi.fn(createApiImageCandidates),
    loadDimensions: vi.fn(
      async (candidates: readonly ImageCandidate[]): Promise<ImageCandidate[]> =>
        candidates.map((candidate) => ({
          ...candidate,
          fetchStatus: 'loaded',
          width: 800,
          height: 1200,
        })),
    ),
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
  it('URL検証からデフォルト選択までを順番に実行する', async () => {
    const calls: string[] = []
    const candidate = createCandidate('0', 'https://example.com/comic/page01.jpg')
    const loadedCandidate: ImageCandidate = {
      ...candidate,
      fetchStatus: 'loaded',
      width: 800,
      height: 1200,
    }
    const selectedCandidate: ImageCandidate = {
      ...loadedCandidate,
      score: 75,
      selectionReasons: ['large-image', 'portrait-aspect-ratio'],
      isSelected: true,
    }
    const dependencies = createDependencies({
      validateUrl: vi.fn((): PageUrlValidation => {
        calls.push('validate')
        return { status: 'valid', url: 'https://example.com/comic/' }
      }),
      fetchHtml: vi.fn(async () => {
        calls.push('fetch')
        return '<img src="page01.jpg">'
      }),
      createCandidates: vi.fn(() => {
        calls.push('create')
        return [candidate]
      }),
      loadDimensions: vi.fn(async () => {
        calls.push('dimensions')
        return [loadedCandidate]
      }),
      scoreCandidates: vi.fn(() => {
        calls.push('score')
        return [selectedCandidate]
      }),
    })
    const states: PageImageAnalysisState[] = []

    await expect(
      analyzePageImages(' https://example.com/comic ', dependencies, (state) => states.push(state)),
    ).resolves.toEqual({
      status: 'success',
      pageUrl: 'https://example.com/comic/',
      acquisitionMethod: 'direct',
      candidates: [selectedCandidate],
    })
    expect(calls).toEqual(['validate', 'fetch', 'create', 'dimensions', 'score'])
    expect(dependencies.analyzeViaApi).not.toHaveBeenCalled()
    expect(states.map(({ status }) => status)).toEqual(['analyzing', 'success'])
  })

  it('画像候補がない場合は空状態にしてサイズ取得以降を実行しない', async () => {
    const dependencies = createDependencies({ createCandidates: vi.fn(() => []) })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual({
      status: 'empty',
      pageUrl: 'https://example.com/comic/',
      acquisitionMethod: 'direct',
    })
    expect(dependencies.analyzeViaApi).not.toHaveBeenCalled()
    expect(dependencies.loadDimensions).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('URL検証失敗時はHTML取得以降を実行しない', async () => {
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
    expect(dependencies.fetchHtml).not.toHaveBeenCalled()
    expect(dependencies.analyzeViaApi).not.toHaveBeenCalled()
    expect(dependencies.createCandidates).not.toHaveBeenCalled()
    expect(dependencies.loadDimensions).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('フォールバック対象外のHTML取得失敗時は候補生成以降を実行しない', async () => {
    const fetchError = new PageHtmlFetchError('http', '取得できません。', { status: 403 })
    const dependencies = createDependencies({
      fetchHtml: vi.fn().mockRejectedValue(fetchError),
    })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual({
      status: 'failure',
      kind: 'html-fetch-failed',
      message: fetchError.message,
      cause: fetchError,
    })
    expect(dependencies.createCandidates).not.toHaveBeenCalled()
    expect(dependencies.analyzeViaApi).not.toHaveBeenCalled()
    expect(dependencies.loadDimensions).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('直接取得の通信失敗時だけ解析APIへ切り替える', async () => {
    const calls: string[] = []
    const apiCandidate: ApiImageCandidate = {
      id: 'image-candidate-0',
      domOrder: 0,
      imageUrl: 'https://cdn.example.com/page01.jpg',
      sourceAttribute: 'src',
      proxyToken: 'signed-token',
      previewToken: 'preview-token',
    }
    const dependencies = createDependencies({
      fetchHtml: vi.fn(async () => {
        calls.push('direct')
        throw new PageHtmlFetchError('network', 'CORSにより取得できません。')
      }),
      analyzeViaApi: vi.fn(async () => {
        calls.push('api')
        return { candidates: [apiCandidate] }
      }),
      createApiCandidates: vi.fn((candidates) => {
        calls.push('convert')
        return createApiImageCandidates(candidates)
      }),
      loadDimensions: vi.fn(async (candidates) => {
        calls.push('dimensions')
        return [...candidates]
      }),
      scoreCandidates: vi.fn((candidates) => {
        calls.push('score')
        return [...candidates]
      }),
    })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual({
      status: 'success',
      pageUrl: 'https://example.com/comic/',
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
    expect(calls).toEqual(['direct', 'api', 'convert', 'score'])
    expect(dependencies.loadDimensions).not.toHaveBeenCalled()
    expect(dependencies.fetchHtml).toHaveBeenCalledOnce()
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
    expect(dependencies.createCandidates).not.toHaveBeenCalled()
  })

  it.each([
    ['Content-Type', new PageHtmlFetchError('unsupportedContentType', 'HTMLではありません。')],
    ['HTTP', new PageHtmlFetchError('http', '取得失敗', { status: 403 })],
  ])('直接取得の%sエラーでは解析APIへ切り替えない', async (_caseName, error) => {
    const dependencies = createDependencies({
      fetchHtml: vi.fn().mockRejectedValue(error),
    })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual(
      expect.objectContaining({ status: 'failure', kind: 'html-fetch-failed' }),
    )
    expect(dependencies.analyzeViaApi).not.toHaveBeenCalled()
  })

  it('解析API失敗時は再度の直接取得やAPI取得を行わない', async () => {
    const apiError = new Error('解析APIに接続できません。')
    const dependencies = createDependencies({
      fetchHtml: vi
        .fn()
        .mockRejectedValue(new PageHtmlFetchError('network', '直接取得できません。')),
      analyzeViaApi: vi.fn().mockRejectedValue(apiError),
    })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual({
      status: 'failure',
      kind: 'html-fetch-failed',
      message: apiError.message,
      cause: apiError,
    })
    expect(dependencies.fetchHtml).toHaveBeenCalledOnce()
    expect(dependencies.analyzeViaApi).toHaveBeenCalledOnce()
  })

  it('サイズ取得失敗時はスコア処理を実行しない', async () => {
    const loadError = new Error('サイズ取得処理が停止しました。')
    const dependencies = createDependencies({
      loadDimensions: vi.fn().mockRejectedValue(loadError),
    })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual({
      status: 'failure',
      kind: 'analysis-failed',
      message: loadError.message,
      cause: loadError,
    })
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('失敗時も解析中から失敗状態へ遷移する', async () => {
    const dependencies = createDependencies({
      createCandidates: vi.fn(() => {
        throw new Error('HTML解析に失敗しました。')
      }),
    })
    const statuses: PageImageAnalysisState['status'][] = []

    await analyzePageImages('https://example.com/comic', dependencies, (state) =>
      statuses.push(state.status),
    )

    expect(statuses).toEqual(['analyzing', 'failure'])
  })
})
