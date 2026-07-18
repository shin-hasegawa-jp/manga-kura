import {
  createRegistrationImages,
  type RegistrationImage,
  type RegistrationImageSource,
} from '@/database/registrationService'
import { fetchSelectedImageBlobs, type ImageBlobBatchFetchResult } from '@/services/imageBlobClient'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import type { PageImageAnalysisState } from '@/services/pageImageAnalyzer'

export type AnalyzedPageRegistrationDetails =
  | {
      mode: 'newSeries'
      seriesTitle: string
      title: string
      sourcePageUrl: string
    }
  | { mode: 'standaloneEpisode'; title: string; sourcePageUrl: string }
  | {
      mode: 'existingSeries'
      seriesId: string
      title: string
      sourcePageUrl: string
    }

export type SaveAnalyzedPageResult =
  | { status: 'success' }
  | {
      status: 'error'
      kind:
        | 'url-not-analyzed'
        | 'no-images-selected'
        | 'incomplete-registration'
        | 'image-fetch-failed'
        | 'registration-failed'
      message: string
    }

export interface SaveAnalyzedPageDependencies {
  fetchImages(candidates: readonly ImageCandidate[]): Promise<ImageBlobBatchFetchResult>
  createImages(imageSources: readonly RegistrationImageSource[]): RegistrationImage[]
  register(images: readonly RegistrationImage[]): Promise<{ status: 'success' | 'error' }>
}

function hasRegistrationDetails(details: AnalyzedPageRegistrationDetails): boolean {
  if (details.title.trim() === '' || details.sourcePageUrl.trim() === '') {
    return false
  }

  switch (details.mode) {
    case 'newSeries':
      return details.seriesTitle.trim() !== ''
    case 'existingSeries':
      return details.seriesId.trim() !== ''
    case 'standaloneEpisode':
      return true
  }
}

export function validateAnalyzedPageSave(
  analysisState: PageImageAnalysisState | undefined,
  details: AnalyzedPageRegistrationDetails,
): SaveAnalyzedPageResult | { status: 'ready'; candidates: readonly ImageCandidate[] } {
  if (analysisState?.status !== 'success') {
    return {
      status: 'error',
      kind: 'url-not-analyzed',
      message: '先にURLを解析してください。',
    }
  }

  const selectedCandidates = analysisState.candidates.filter(({ isSelected }) => isSelected)
  if (selectedCandidates.length === 0) {
    return {
      status: 'error',
      kind: 'no-images-selected',
      message: '保存する画像を1件以上選択してください。',
    }
  }

  if (!hasRegistrationDetails(details)) {
    return {
      status: 'error',
      kind: 'incomplete-registration',
      message: '登録情報の必須項目を入力してください。',
    }
  }

  return { status: 'ready', candidates: selectedCandidates }
}

const defaultDependencies: Omit<SaveAnalyzedPageDependencies, 'register'> = {
  fetchImages: fetchSelectedImageBlobs,
  createImages: createRegistrationImages,
}

export async function saveAnalyzedPage(
  analysisState: PageImageAnalysisState | undefined,
  details: AnalyzedPageRegistrationDetails,
  dependencies: Pick<SaveAnalyzedPageDependencies, 'register'> &
    Partial<Omit<SaveAnalyzedPageDependencies, 'register'>>,
): Promise<SaveAnalyzedPageResult> {
  const validation = validateAnalyzedPageSave(analysisState, details)
  if (validation.status !== 'ready') {
    return validation
  }

  const fetchImages = dependencies.fetchImages ?? defaultDependencies.fetchImages
  const createImages = dependencies.createImages ?? defaultDependencies.createImages
  const fetchResult = await fetchImages(validation.candidates)

  if (fetchResult.status !== 'success') {
    return {
      status: 'error',
      kind: 'image-fetch-failed',
      message: '選択した画像を取得できませんでした。保存は開始されていません。',
    }
  }

  const registration = await dependencies.register(createImages(fetchResult.images))
  if (registration.status === 'error') {
    return {
      status: 'error',
      kind: 'registration-failed',
      message: '画像を保存できませんでした。入力内容を確認してください。',
    }
  }

  return { status: 'success' }
}
