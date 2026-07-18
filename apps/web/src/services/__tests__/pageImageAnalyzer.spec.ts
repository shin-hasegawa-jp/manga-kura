import { describe, expect, it, vi } from 'vitest'
import type { ImageCandidate } from '../imageCandidateFactory'
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
    createCandidates: vi.fn(() => [createCandidate('0', 'https://example.com/comic/page01.jpg')]),
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
      candidates: [selectedCandidate],
    })
    expect(calls).toEqual(['validate', 'fetch', 'create', 'dimensions', 'score'])
    expect(states.map(({ status }) => status)).toEqual(['analyzing', 'success'])
  })

  it('画像候補がない場合は空状態にしてサイズ取得以降を実行しない', async () => {
    const dependencies = createDependencies({ createCandidates: vi.fn(() => []) })

    await expect(analyzePageImages('https://example.com/comic', dependencies)).resolves.toEqual({
      status: 'empty',
      pageUrl: 'https://example.com/comic/',
    })
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
    expect(dependencies.createCandidates).not.toHaveBeenCalled()
    expect(dependencies.loadDimensions).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
  })

  it('HTML取得失敗時は候補生成以降を実行しない', async () => {
    const fetchError = new Error('CORSにより取得できません。')
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
    expect(dependencies.loadDimensions).not.toHaveBeenCalled()
    expect(dependencies.scoreCandidates).not.toHaveBeenCalled()
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
