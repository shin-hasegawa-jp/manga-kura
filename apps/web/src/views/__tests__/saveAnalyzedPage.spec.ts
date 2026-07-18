import { describe, expect, it, vi } from 'vitest'
import type { RegistrationImage } from '@/database/registrationService'
import type { FetchedImageBlob, ImageBlobBatchFetchResult } from '@/services/imageBlobClient'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import type { PageImageAnalysisState } from '@/services/pageImageAnalyzer'
import {
  saveAnalyzedPage,
  type AnalyzedPageRegistrationDetails,
  type SaveAnalyzedPageDependencies,
} from '../saveAnalyzedPage'

function createCandidate(isSelected = true): ImageCandidate {
  return {
    id: 'candidate-1',
    domOrder: 0,
    imageUrl: 'https://example.com/images/page01.png',
    sourceAttribute: 'src',
    isSelected,
    score: 90,
    selectionReasons: ['sequential-filename'],
    fetchStatus: 'loaded',
    acquisitionMethod: 'direct',
    width: 800,
    height: 1200,
  }
}

function createApiCandidate(): Extract<ImageCandidate, { acquisitionMethod: 'api' }> {
  return {
    ...createCandidate(),
    acquisitionMethod: 'api',
    proxyToken: 'proxy-token',
  }
}

const validDetails: AnalyzedPageRegistrationDetails = {
  mode: 'newSeries',
  seriesTitle: '作品名',
  title: '第1話',
  sourcePageUrl: 'https://example.com/comic/1',
}

function createDependencies(): SaveAnalyzedPageDependencies {
  const fetchedImage: FetchedImageBlob = {
    candidateId: 'candidate-1',
    domOrder: 0,
    blob: new Blob(['image'], { type: 'image/png' }),
    sourceUrl: 'https://example.com/images/page01.png',
    mimeType: 'image/png',
    fileSize: 5,
    width: 800,
    height: 1200,
  }
  const registrationImage: RegistrationImage = {
    ...fetchedImage,
    id: 'registration-image-1',
    displayOrder: 0,
  }

  return {
    fetchImages: vi.fn(
      async (): Promise<ImageBlobBatchFetchResult> => ({
        status: 'success',
        images: [fetchedImage],
        failures: [],
      }),
    ),
    createImages: vi.fn(() => [registrationImage]),
    register: vi.fn(async (): Promise<{ status: 'success' | 'error' }> => ({ status: 'success' })),
  }
}

interface InvalidSaveCase {
  caseName: string
  analysisState: PageImageAnalysisState | undefined
  details: AnalyzedPageRegistrationDetails
  kind: string
}

const invalidSaveCases: InvalidSaveCase[] = [
  {
    caseName: 'URL未解析',
    analysisState: undefined,
    details: validDetails,
    kind: 'url-not-analyzed',
  },
  {
    caseName: '画像未選択',
    analysisState: {
      status: 'success',
      pageUrl: validDetails.sourcePageUrl,
      acquisitionMethod: 'direct',
      candidates: [createCandidate(false)],
    },
    details: validDetails,
    kind: 'no-images-selected',
  },
  {
    caseName: '登録情報不足',
    analysisState: {
      status: 'success',
      pageUrl: validDetails.sourcePageUrl,
      acquisitionMethod: 'direct',
      candidates: [createCandidate()],
    },
    details: { ...validDetails, seriesTitle: '' },
    kind: 'incomplete-registration',
  },
]

describe('解析済みページの保存フロー', () => {
  it.each(invalidSaveCases)(
    '$caseNameの場合は画像取得と登録を開始しない',
    async ({ analysisState, details, kind }) => {
      const dependencies = createDependencies()

      const result = await saveAnalyzedPage(analysisState, details, dependencies)

      expect(result).toMatchObject({ status: 'error', kind })
      expect(dependencies.fetchImages).not.toHaveBeenCalled()
      expect(dependencies.createImages).not.toHaveBeenCalled()
      expect(dependencies.register).not.toHaveBeenCalled()
    },
  )

  it('選択画像を取得して登録用画像へ変換し、登録処理へ渡す', async () => {
    const candidate = createCandidate()
    const dependencies = createDependencies()

    await expect(
      saveAnalyzedPage(
        {
          status: 'success',
          pageUrl: validDetails.sourcePageUrl,
          acquisitionMethod: 'direct',
          candidates: [candidate],
        },
        validDetails,
        dependencies,
      ),
    ).resolves.toEqual({ status: 'success' })
    expect(dependencies.fetchImages).toHaveBeenCalledWith([candidate])
    expect(dependencies.createImages).toHaveBeenCalledTimes(1)
    expect(dependencies.register).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'registration-image-1' })]),
    )
  })

  it.each<{
    caseName: string
    details: AnalyzedPageRegistrationDetails
  }>([
    { caseName: '新規作品', details: validDetails },
    {
      caseName: '単独の話',
      details: {
        mode: 'standaloneEpisode',
        title: '第1話',
        sourcePageUrl: validDetails.sourcePageUrl,
      },
    },
    {
      caseName: '既存作品への話追加',
      details: {
        mode: 'existingSeries',
        seriesId: 'series-1',
        title: '第1話',
        sourcePageUrl: validDetails.sourcePageUrl,
      },
    },
  ])('API候補を$caseNameの登録処理へ渡す', async ({ details }) => {
    const candidate = createApiCandidate()
    const dependencies = createDependencies()

    await expect(
      saveAnalyzedPage(
        {
          status: 'success',
          pageUrl: validDetails.sourcePageUrl,
          acquisitionMethod: 'api',
          candidates: [candidate],
        },
        details,
        dependencies,
      ),
    ).resolves.toEqual({ status: 'success' })
    expect(dependencies.fetchImages).toHaveBeenCalledExactlyOnceWith([candidate])
    expect(dependencies.register).toHaveBeenCalledOnce()
  })

  it('一部画像の取得に失敗した場合は登録処理を開始しない', async () => {
    const dependencies = createDependencies()
    dependencies.fetchImages = vi.fn(
      async (): Promise<ImageBlobBatchFetchResult> => ({
        status: 'partial-failure',
        images: [],
        failures: [],
      }),
    )

    const result = await saveAnalyzedPage(
      {
        status: 'success',
        pageUrl: validDetails.sourcePageUrl,
        acquisitionMethod: 'direct',
        candidates: [createCandidate()],
      },
      validDetails,
      dependencies,
    )

    expect(result).toMatchObject({ status: 'error', kind: 'image-fetch-failed' })
    expect(dependencies.createImages).not.toHaveBeenCalled()
    expect(dependencies.register).not.toHaveBeenCalled()
  })
})
