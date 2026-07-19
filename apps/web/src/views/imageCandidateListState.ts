import type { ImageCandidate } from '@/services/imageCandidateFactory'
import type { PageImageAnalysisState } from '@/services/pageImageAnalyzer'
import { getPageAnalysisErrorPresentation } from './acquisitionErrorPresenter'

export type ImageCandidateListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | {
      kind: 'empty'
      pageUrl: string
      message: string
    }
  | { kind: 'failure'; message: string }
  | {
      kind: 'populated'
      pageUrl: string
      candidates: readonly ImageCandidate[]
    }

export function getImageCandidateListState(
  analysisState: PageImageAnalysisState | undefined,
): ImageCandidateListState {
  if (analysisState === undefined) {
    return { kind: 'idle' }
  }

  switch (analysisState.status) {
    case 'analyzing':
      return { kind: 'loading' }
    case 'empty':
      return {
        kind: 'empty',
        pageUrl: analysisState.pageUrl,
        message: getPageAnalysisErrorPresentation(analysisState).message,
      }
    case 'failure':
      return {
        kind: 'failure',
        message: getPageAnalysisErrorPresentation(analysisState).message,
      }
    case 'success':
      return {
        kind: 'populated',
        pageUrl: analysisState.pageUrl,
        candidates: analysisState.candidates,
      }
  }
}
