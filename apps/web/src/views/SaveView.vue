<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  mdiAlertOutline,
  mdiCheck,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronUp,
  mdiFileRemoveOutline,
  mdiImageSearchOutline,
  mdiLockOutline,
  mdiShieldCheckOutline,
  mdiWifiOff,
} from '@mdi/js'
import { useExistingSeriesEpisodeRegistration } from '@/composables/useExistingSeriesEpisodeRegistration'
import { useNewSeriesRegistration } from '@/composables/useNewSeriesRegistration'
import { useStandaloneEpisodeRegistration } from '@/composables/useStandaloneEpisodeRegistration'
import { database } from '@/database/database'
import { createMangaRepository } from '@/database/repository'
import { findDuplicateRegistrations } from '@/database/duplicateUrl'
import type { RegistrationImage } from '@/database/registrationService'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import { createProxiedImageUrl } from '@/services/acquisitionApiClient'
import { createSelectedImageBlobFetcher } from '@/services/imageBlobClient'
import {
  createDatabaseImageDuplicateDetector,
  type DuplicateImageMatch,
} from '@/services/imageDuplicateDetector'
import { analyzePageImages, type PageImageAnalysisState } from '@/services/pageImageAnalyzer'
import {
  rankExistingSeriesSuggestions,
  type ExistingSeriesSuggestion,
} from '@/services/existingSeriesSuggestions'
import {
  createSaveMetadataSuggestions,
  type SaveMetadataSuggestions,
} from '@/services/saveMetadataSuggestions'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import AppIcon from '@/components/AppIcon.vue'
import SaveStepIndicator from '@/components/SaveStepIndicator.vue'
import { getSaveErrorPresentation, markImageFetchFailures } from './acquisitionErrorPresenter'
import { getSaveOfflineNotice } from './offlineNotice'
import { getImageCandidateListState } from './imageCandidateListState'
import { getPreviewImageFetchPriority, getPreviewImageLoading } from './previewImageLoading'
import {
  clearAllImageCandidateSelections,
  getImageCandidateSelectionState,
  selectAllImageCandidates,
  toggleImageCandidateSelection,
} from './imageCandidateSelection'
import {
  moveSelectedCandidate,
  orderImageCandidatesForDisplay,
  orderImageCandidatesForSaving,
  reconcileSelectedCandidateOrder,
  type ImageCandidateMove,
} from './imageCandidateOrder'
import {
  saveAnalyzedPage,
  validateAnalyzedPageSave,
  type AnalyzedPageRegistrationDetails,
} from './saveAnalyzedPage'
import { toDuplicateRegistrationViews, type DuplicateRegistrationView } from './duplicateUrlWarning'
import { registrationModeOptions, type RegistrationMode } from './saveRegistrationMode'

const registrationMode = ref<RegistrationMode>('newSeries')
const router = useRouter()
const { isOnline } = useOnlineStatus()
// 新規保存はページ取得の通信を要するため、オフライン時は解析を止めて理由を示す。
const offlineNotice = computed(() => getSaveOfflineNotice(isOnline.value))
const repository = createMangaRepository(database)
// 重複URL警告：登録済み情報を保持している間は保存を保留する
const duplicateWarning = ref<DuplicateRegistrationView[]>()
const duplicateImageWarning = ref<DuplicateImageMatch[]>()
const detectDuplicateImages = createDatabaseImageDuplicateDetector(database)
const pageUrl = ref('')
const pageImageAnalysisState = ref<PageImageAnalysisState>()
const isSavingAnalyzedPage = ref(false)
const saveFlowError = ref('')
const saveProgress = ref({ completedCount: 0, totalCount: 0 })
const metadataSuggestions = ref<SaveMetadataSuggestions>({})
const existingSeriesSuggestions = ref<ExistingSeriesSuggestion[]>([])
const selectedCandidateOrder = ref<string[]>([])
const orderAnnouncement = ref('')

function createAnalyzedImageFetcher() {
  return createSelectedImageBlobFetcher({
    onProgress: (progress) => {
      saveProgress.value = progress
    },
  })
}

let fetchAnalyzedImages = createAnalyzedImageFetcher()
// 進行中の解析を識別し、キャンセル・URL編集で古い解析結果を無視する
let analysisToken = 0
// 画像確認（ステップ2）と情報入力（ステップ3）の切り替え
const saveStage = ref<'image' | 'info' | 'saving' | 'complete'>('image')
const showRegistrationErrors = ref(false)
const completedRegistration = ref<{
  title: string
  seriesLabel: string
  imageCount: number
}>()
// プレビュー画像の読み込みに失敗した候補ID（保存時の取得失敗=fetchStatus 'failed' とは区別する）
const previewErrorIds = ref<ReadonlySet<string>>(new Set())
const imageCandidateListState = computed(() =>
  getImageCandidateListState(pageImageAnalysisState.value),
)
const imageCandidateSelectionState = computed(() =>
  getImageCandidateSelectionState(
    imageCandidateListState.value.kind === 'populated'
      ? imageCandidateListState.value.candidates
      : [],
  ),
)
const displayedImageCandidates = computed(() =>
  imageCandidateListState.value.kind === 'populated'
    ? orderImageCandidatesForDisplay(
        imageCandidateListState.value.candidates,
        selectedCandidateOrder.value,
      )
    : [],
)

// 解析状態からステップ1（URL入力）内の表示を決める
const urlStepView = computed<'form' | 'analyzing' | 'fetchFailed' | 'noCandidates'>(() => {
  const state = pageImageAnalysisState.value
  if (state === undefined) {
    return 'form'
  }
  switch (state.status) {
    case 'analyzing':
      return 'analyzing'
    case 'failure':
      return state.kind === 'invalid-url' ? 'form' : 'fetchFailed'
    case 'empty':
      return 'noCandidates'
    case 'success':
      return 'form'
    default: {
      // 網羅性チェック：statusにcaseが追加された場合に型エラーで検知する
      const exhaustiveCheck: never = state
      return exhaustiveCheck
    }
  }
})
const urlValidationMessage = computed(() => {
  const state = pageImageAnalysisState.value
  return state?.status === 'failure' && state.kind === 'invalid-url' ? state.message : ''
})
const fetchFailureMessage = computed(() => {
  const state = pageImageAnalysisState.value
  return state?.status === 'failure' && state.kind !== 'invalid-url' ? state.message : ''
})
// ステップは解析成功時のみ2以降へ進む。画像確認=2、情報入力=3。
const currentStep = computed(() => {
  if (saveStage.value === 'saving' || saveStage.value === 'complete') {
    return 4
  }
  if (imageCandidateListState.value.kind !== 'populated') {
    return 1
  }
  return saveStage.value === 'info' ? 3 : 2
})

const registrationFieldsComplete = computed(() => {
  switch (registrationMode.value) {
    case 'newSeries':
      return (
        newSeriesTitle.value.trim() !== '' &&
        newSeriesEpisodeTitle.value.trim() !== '' &&
        newSeriesSourcePageUrl.value.trim() !== ''
      )
    case 'standaloneEpisode':
      return (
        standaloneEpisodeTitle.value.trim() !== '' &&
        standaloneEpisodeSourcePageUrl.value.trim() !== ''
      )
    case 'existingSeries':
      return (
        existingSeriesId.value.trim() !== '' &&
        existingSeriesEpisodeTitle.value.trim() !== '' &&
        existingSeriesEpisodeSourcePageUrl.value.trim() !== ''
      )
    default: {
      // 網羅性チェック：RegistrationModeにcaseが追加された場合に型エラーで検知する
      const exhaustiveCheck: never = registrationMode.value
      return exhaustiveCheck
    }
  }
})

function candidateFailureKind(candidate: ImageCandidate): 'save' | 'preview' | undefined {
  if (candidate.fetchStatus === 'failed') {
    return 'save'
  }
  if (previewErrorIds.value.has(candidate.id)) {
    return 'preview'
  }
  return undefined
}

function onPreviewError(candidateId: string) {
  const next = new Set(previewErrorIds.value)
  next.add(candidateId)
  previewErrorIds.value = next
}

function proceedToInfo() {
  if (imageCandidateSelectionState.value.canSave) {
    saveStage.value = 'info'
  }
}

// ヘッダーの戻る：情報入力→画像確認、画像確認→URL入力
function goBack() {
  if (currentStep.value === 3) {
    saveStage.value = 'image'
    return
  }
  returnToUrlInput()
}

const {
  newSeriesTitle,
  newSeriesEpisodeTitle,
  newSeriesEpisodeNumber,
  newSeriesSourcePageUrl,
  registerNewSeries,
  resetNewSeriesFields,
  clearNewSeriesSubmission,
} = useNewSeriesRegistration()
const {
  standaloneEpisodeTitle,
  standaloneEpisodeNumber,
  standaloneEpisodeSourcePageUrl,
  registerStandaloneEpisode,
  resetStandaloneEpisodeFields,
  clearStandaloneEpisodeSubmission,
} = useStandaloneEpisodeRegistration()
const {
  seriesOptions,
  existingSeriesId,
  existingSeriesEpisodeTitle,
  existingSeriesEpisodeNumber,
  existingSeriesEpisodeSourcePageUrl,
  loadSeriesOptions,
  registerExistingSeriesEpisode,
  resetExistingSeriesEpisodeFields,
  clearExistingSeriesEpisodeSubmission,
} = useExistingSeriesEpisodeRegistration()

async function analyzePageUrl() {
  // オフライン中はページ取得の通信ができないため解析を始めない（UIの非活性と二重で防ぐ）。
  if (!isOnline.value) {
    return
  }
  if (pageImageAnalysisState.value?.status === 'analyzing') {
    return
  }

  const token = ++analysisToken
  fetchAnalyzedImages = createAnalyzedImageFetcher()
  saveFlowError.value = ''
  saveStage.value = 'image'
  showRegistrationErrors.value = false
  completedRegistration.value = undefined
  previewErrorIds.value = new Set()
  const result = await analyzePageImages(pageUrl.value, undefined, (state) => {
    if (token === analysisToken) {
      pageImageAnalysisState.value = state
    }
  })

  if (token !== analysisToken) {
    return
  }

  if (result.status === 'success' || result.status === 'empty') {
    pageUrl.value = result.pageUrl
    newSeriesSourcePageUrl.value = result.pageUrl
    standaloneEpisodeSourcePageUrl.value = result.pageUrl
    existingSeriesEpisodeSourcePageUrl.value = result.pageUrl
  }

  if (result.status === 'success') {
    selectedCandidateOrder.value = reconcileSelectedCandidateOrder(result.candidates, [])
    const suggestions = createSaveMetadataSuggestions(result.pageTitle, result.pageUrl)
    metadataSuggestions.value = suggestions

    if (newSeriesTitle.value.trim() === '' && suggestions.seriesTitle) {
      newSeriesTitle.value = suggestions.seriesTitle
    }
    if (newSeriesEpisodeTitle.value.trim() === '' && suggestions.episodeTitle) {
      newSeriesEpisodeTitle.value = suggestions.episodeTitle
    }
    if (standaloneEpisodeTitle.value.trim() === '' && suggestions.episodeTitle) {
      standaloneEpisodeTitle.value = suggestions.episodeTitle
    }
    if (existingSeriesEpisodeTitle.value.trim() === '' && suggestions.episodeTitle) {
      existingSeriesEpisodeTitle.value = suggestions.episodeTitle
    }
    if (suggestions.episodeNumber !== undefined) {
      newSeriesEpisodeNumber.value ??= suggestions.episodeNumber
      standaloneEpisodeNumber.value ??= suggestions.episodeNumber
      existingSeriesEpisodeNumber.value ??= suggestions.episodeNumber
    }

    const [savedSeries, savedEpisodes] = await Promise.all([
      repository.series.findAll(),
      repository.episodes.findAll(),
    ])
    if (token !== analysisToken) {
      return
    }
    existingSeriesSuggestions.value = rankExistingSeriesSuggestions(
      savedSeries,
      savedEpisodes,
      suggestions.seriesTitle,
      result.pageUrl,
    )
  }
}

// 解析のキャンセル・URL編集への復帰（入力したURLは保持する）
function returnToUrlInput() {
  analysisToken += 1
  pageImageAnalysisState.value = undefined
  saveFlowError.value = ''
  saveStage.value = 'image'
  showRegistrationErrors.value = false
  completedRegistration.value = undefined
  previewErrorIds.value = new Set()
  metadataSuggestions.value = {}
  existingSeriesSuggestions.value = []
  selectedCandidateOrder.value = []
  orderAnnouncement.value = ''
}

function getCandidatePreviewUrl(candidate: ImageCandidate): string {
  return createProxiedImageUrl(candidate.previewToken)
}

function getCurrentRegistrationDetails(): AnalyzedPageRegistrationDetails {
  switch (registrationMode.value) {
    case 'newSeries':
      return {
        mode: 'newSeries',
        seriesTitle: newSeriesTitle.value,
        title: newSeriesEpisodeTitle.value,
        episodeNumber: newSeriesEpisodeNumber.value,
        sourcePageUrl: newSeriesSourcePageUrl.value,
      }
    case 'standaloneEpisode':
      return {
        mode: 'standaloneEpisode',
        title: standaloneEpisodeTitle.value,
        episodeNumber: standaloneEpisodeNumber.value,
        sourcePageUrl: standaloneEpisodeSourcePageUrl.value,
      }
    case 'existingSeries':
      return {
        mode: 'existingSeries',
        seriesId: existingSeriesId.value,
        title: existingSeriesEpisodeTitle.value,
        episodeNumber: existingSeriesEpisodeNumber.value,
        sourcePageUrl: existingSeriesEpisodeSourcePageUrl.value,
      }
  }
}

function registerMode(mode: RegistrationMode, images: readonly RegistrationImage[]) {
  switch (mode) {
    case 'newSeries':
      return registerNewSeries(images)
    case 'standaloneEpisode':
      return registerStandaloneEpisode(images)
    case 'existingSeries':
      return registerExistingSeriesEpisode(images)
  }
}

async function saveCurrentRegistration(
  options: { allowDuplicateUrl?: boolean; allowDuplicateImages?: boolean } = {},
) {
  if (isSavingAnalyzedPage.value) {
    return
  }

  saveFlowError.value = ''
  showRegistrationErrors.value = true

  const details = getCurrentRegistrationDetails()
  const orderedAnalysisState = getOrderedAnalysisState()
  const validation = validateAnalyzedPageSave(orderedAnalysisState, details)
  if (validation.status !== 'ready') {
    saveFlowError.value =
      validation.status === 'error' ? validation.message : '登録情報を確認してください。'
    return
  }

  // 明示的に重複保存を選んでいない場合は、同一URLの既存話を警告する
  if (!options.allowDuplicateUrl) {
    const duplicates = await findDuplicateRegistrations(repository, details.sourcePageUrl.trim())
    if (duplicates.length > 0) {
      duplicateWarning.value = toDuplicateRegistrationViews(duplicates)
      return
    }
  }

  const completion = {
    title: details.title.trim(),
    seriesLabel:
      details.mode === 'newSeries'
        ? details.seriesTitle.trim()
        : details.mode === 'existingSeries'
          ? (seriesOptions.value.find(({ id }) => id === details.seriesId)?.title ?? '既存作品')
          : '単独の話',
    imageCount: validation.candidates.length,
  }

  isSavingAnalyzedPage.value = true
  saveProgress.value = { completedCount: 0, totalCount: validation.candidates.length }
  saveStage.value = 'saving'

  try {
    const result = await saveAnalyzedPage(
      orderedAnalysisState,
      details,
      {
        fetchImages: fetchAnalyzedImages,
        detectDuplicates: detectDuplicateImages,
        register: (images) => registerMode(details.mode, images),
      },
      {
        allowImageDuplicates: options.allowDuplicateImages,
      },
    )

    if (result.status === 'duplicate-images') {
      duplicateImageWarning.value = [...result.matches]
      saveStage.value = 'info'
      return
    }

    if (result.status === 'error') {
      const candidates =
        pageImageAnalysisState.value?.status === 'success'
          ? pageImageAnalysisState.value.candidates
          : []
      saveFlowError.value = getSaveErrorPresentation(result, candidates).message

      if (result.kind === 'image-fetch-failed') {
        updateImageCandidates((currentCandidates) =>
          markImageFetchFailures(currentCandidates, result.failures),
        )
      }
      saveStage.value = 'info'
      return
    }

    completedRegistration.value = completion
    pageUrl.value = ''
    pageImageAnalysisState.value = undefined
    fetchAnalyzedImages = createAnalyzedImageFetcher()
    saveStage.value = 'complete'
    previewErrorIds.value = new Set()
    metadataSuggestions.value = {}
    existingSeriesSuggestions.value = []
    showRegistrationErrors.value = false
    resetNewSeriesFields()
    resetStandaloneEpisodeFields()
    resetExistingSeriesEpisodeFields()
  } finally {
    isSavingAnalyzedPage.value = false
  }
}

function cancelDuplicateSave() {
  // 入力・選択状態を保持したまま情報入力へ戻る
  duplicateWarning.value = undefined
}

function confirmDuplicateSave() {
  duplicateWarning.value = undefined
  void saveCurrentRegistration({ allowDuplicateUrl: true })
}

function cancelDuplicateImageSave() {
  duplicateImageWarning.value = undefined
  saveStage.value = 'image'
}

function confirmDuplicateImageSave() {
  duplicateImageWarning.value = undefined
  void saveCurrentRegistration({ allowDuplicateUrl: true, allowDuplicateImages: true })
}

function continueSaving() {
  completedRegistration.value = undefined
  saveStage.value = 'image'
  registrationMode.value = 'newSeries'
  saveFlowError.value = ''
}

async function goToLibrary() {
  await router.push({ name: 'library' })
}

function updateImageCandidates(
  update: (candidates: readonly ImageCandidate[]) => ImageCandidate[],
) {
  const state = pageImageAnalysisState.value
  if (state?.status !== 'success') {
    return
  }

  pageImageAnalysisState.value = {
    ...state,
    candidates: update(state.candidates),
  }
}

function toggleCandidate(candidateId: string) {
  updateImageCandidates((candidates) => {
    const next = toggleImageCandidateSelection(candidates, candidateId)
    selectedCandidateOrder.value = reconcileSelectedCandidateOrder(
      next,
      selectedCandidateOrder.value,
    )
    return next
  })
}

function selectAllCandidates() {
  updateImageCandidates((candidates) => {
    const next = selectAllImageCandidates(candidates)
    selectedCandidateOrder.value = reconcileSelectedCandidateOrder(
      next,
      selectedCandidateOrder.value,
    )
    return next
  })
}

function clearAllCandidateSelections() {
  updateImageCandidates((candidates) => {
    const next = clearAllImageCandidateSelections(candidates)
    selectedCandidateOrder.value = []
    return next
  })
}

function getSelectedOrderIndex(candidateId: string): number {
  return selectedCandidateOrder.value.indexOf(candidateId)
}

function moveCandidate(candidateId: string, move: ImageCandidateMove) {
  selectedCandidateOrder.value = moveSelectedCandidate(
    selectedCandidateOrder.value,
    candidateId,
    move,
  )
  const index = getSelectedOrderIndex(candidateId)
  const candidate =
    pageImageAnalysisState.value?.status === 'success'
      ? pageImageAnalysisState.value.candidates.find(({ id }) => id === candidateId)
      : undefined
  orderAnnouncement.value = `画像候補 ${(candidate?.domOrder ?? index) + 1} を保存順 ${index + 1}番へ移動しました。`
}

function getOrderedAnalysisState(): PageImageAnalysisState | undefined {
  const state = pageImageAnalysisState.value
  if (state?.status !== 'success') return state
  return {
    ...state,
    candidates: orderImageCandidatesForSaving(state.candidates, selectedCandidateOrder.value),
  }
}

function selectRegistrationMode(mode: RegistrationMode) {
  if (isSavingAnalyzedPage.value) {
    return
  }
  registrationMode.value = mode
  clearNewSeriesSubmission()
  clearStandaloneEpisodeSubmission()
  clearExistingSeriesEpisodeSubmission()
  saveFlowError.value = ''
  showRegistrationErrors.value = false

  if (mode === 'existingSeries') {
    void loadSeriesOptions()
  }
}

function applySeriesTitleSuggestion() {
  if (metadataSuggestions.value.seriesTitle) {
    newSeriesTitle.value = metadataSuggestions.value.seriesTitle
  }
}

function applyEpisodeTitleSuggestion() {
  const title = metadataSuggestions.value.episodeTitle
  if (!title) {
    return
  }
  switch (registrationMode.value) {
    case 'newSeries':
      newSeriesEpisodeTitle.value = title
      break
    case 'standaloneEpisode':
      standaloneEpisodeTitle.value = title
      break
    case 'existingSeries':
      existingSeriesEpisodeTitle.value = title
      break
  }
}

function applyEpisodeNumberSuggestion() {
  const episodeNumber = metadataSuggestions.value.episodeNumber
  if (episodeNumber === undefined) {
    return
  }
  switch (registrationMode.value) {
    case 'newSeries':
      newSeriesEpisodeNumber.value = episodeNumber
      break
    case 'standaloneEpisode':
      standaloneEpisodeNumber.value = episodeNumber
      break
    case 'existingSeries':
      existingSeriesEpisodeNumber.value = episodeNumber
      break
  }
}

function applyExistingSeriesSuggestion(seriesId: string) {
  existingSeriesId.value = seriesId
}
</script>

<template>
  <main class="save-view">
    <header v-if="saveStage !== 'saving' && saveStage !== 'complete'" class="save-header">
      <button
        v-if="currentStep > 1"
        class="app-icon-btn save-header__back"
        type="button"
        :aria-label="currentStep === 3 ? '画像確認へ戻る' : 'URL入力へ戻る'"
        @click="goBack"
      >
        <AppIcon :path="mdiChevronLeft" :size="28" />
      </button>
      <h1 class="app-display save-header__title">保存</h1>
    </header>

    <SaveStepIndicator
      v-if="saveStage !== 'saving' && saveStage !== 'complete'"
      :current="currentStep"
    />

    <!-- ステップ4：保存中 -->
    <section v-if="saveStage === 'saving'" class="saving-state" aria-live="polite" aria-busy="true">
      <span class="saving-state__spinner" aria-hidden="true"></span>
      <h1 class="app-heading saving-state__title">蔵にしまっています</h1>
      <p>
        {{
          saveProgress.totalCount > 0
            ? `${saveProgress.completedCount} / ${saveProgress.totalCount}枚を処理中`
            : `${imageCandidateSelectionState.selectedCount}枚の画像を保存しています`
        }}
      </p>
      <p class="saving-state__wait">画面を閉じずにお待ちください</p>
      <span class="saving-state__bar" aria-hidden="true"><span></span></span>
      <p class="saving-state__lock">
        <AppIcon :path="mdiLockOutline" :size="18" />
        保存が終わるまで他の操作はできません
      </p>
    </section>

    <!-- ステップ4：保存完了 -->
    <section
      v-else-if="saveStage === 'complete'"
      class="complete-state"
      aria-labelledby="save-complete-title"
    >
      <div class="complete-state__check" aria-hidden="true">
        <AppIcon :path="mdiCheck" :size="48" />
      </div>
      <h1 id="save-complete-title" class="app-display complete-state__title">蔵にしまいました</h1>
      <p v-if="completedRegistration" class="complete-state__summary">
        「{{ completedRegistration.title }}」を<br />
        {{ completedRegistration.imageCount }}枚で保存したよ。
      </p>
      <div v-if="completedRegistration" class="complete-state__card">
        <span class="complete-state__thumbnail" aria-hidden="true"></span>
        <span>
          <strong>{{ completedRegistration.title }}</strong>
          <small>{{ completedRegistration.seriesLabel }}</small>
        </span>
      </div>
      <button class="app-btn app-btn--primary app-btn--block" type="button" @click="goToLibrary">
        本棚で見る
      </button>
      <button
        class="app-btn app-btn--secondary app-btn--block"
        type="button"
        @click="continueSaving"
      >
        続けて保存
      </button>
    </section>

    <!-- ステップ1：URL入力 -->
    <section v-else-if="currentStep === 1" aria-label="URL入力">
      <!-- 初期状態・URL検証エラー -->
      <form
        v-if="urlStepView === 'form'"
        class="url-step"
        aria-label="取得元ページURL"
        @submit.prevent="analyzePageUrl"
      >
        <h2 class="app-heading url-step__title">漫画のページを開く</h2>
        <p class="url-step__description">
          漫画が載っているWebページのURLを貼り付けてね。ページの中から画像の候補をさがすよ。
        </p>
        <!-- オフライン中は新規保存に必要な通信ができないことを示す -->
        <p v-if="offlineNotice" class="save-offline" role="status">
          <AppIcon :path="mdiWifiOff" :size="20" class="save-offline__icon" aria-hidden="true" />
          <span>{{ offlineNotice.message }}</span>
        </p>
        <label class="app-field-label">
          <span>ページのURL</span>
          <input
            v-model="pageUrl"
            class="app-field"
            name="pageUrl"
            type="text"
            inputmode="url"
            autocomplete="url"
            placeholder="https://example.com/comic/1"
            :aria-invalid="urlValidationMessage !== ''"
            :aria-describedby="urlValidationMessage !== '' ? 'page-url-message' : undefined"
          />
        </label>
        <p
          v-if="urlValidationMessage"
          id="page-url-message"
          class="app-message app-message--error"
          role="alert"
        >
          {{ urlValidationMessage }}
        </p>
        <p class="save-privacy">
          <AppIcon :path="mdiShieldCheckOutline" :size="20" class="save-privacy__icon" />
          <span>
            取り込んだ画像は<strong>この端末の中だけ</strong>に保存されるよ。サーバーには残らない。
          </span>
        </p>
        <button class="app-btn app-btn--primary app-btn--block" type="submit" :disabled="!isOnline">
          ページを解析する
        </button>
      </form>

      <!-- 解析中 -->
      <div v-else-if="urlStepView === 'analyzing'" class="url-status" role="status">
        <span class="save-spinner" aria-hidden="true"></span>
        <p class="url-status__title app-heading">ページを読み込んでいます…</p>
        <p class="url-status__message">漫画らしい画像をさがしています。</p>
        <p class="url-status__url">{{ pageUrl }}</p>
        <button
          class="app-btn app-btn--secondary app-btn--block"
          type="button"
          @click="returnToUrlInput"
        >
          キャンセル
        </button>
      </div>

      <!-- 取得失敗 -->
      <div v-else-if="urlStepView === 'fetchFailed'" class="url-status" role="alert">
        <div class="url-status__icon" aria-hidden="true">
          <AppIcon :path="mdiFileRemoveOutline" :size="40" />
        </div>
        <p class="url-status__title app-heading">ページを読み込めませんでした</p>
        <p class="url-status__message">
          {{
            fetchFailureMessage ||
            'ページが表示できないか、画像の取得が許可されていないみたい。URLをもう一度確認してね。'
          }}
        </p>
        <button
          class="app-btn app-btn--primary app-btn--block"
          type="button"
          @click="analyzePageUrl"
        >
          もう一度試す
        </button>
        <button
          class="app-btn app-btn--secondary app-btn--block"
          type="button"
          @click="returnToUrlInput"
        >
          URLを直す
        </button>
      </div>

      <!-- 候補なし -->
      <div v-else class="url-status">
        <div class="url-status__icon" aria-hidden="true">
          <AppIcon :path="mdiImageSearchOutline" :size="40" />
        </div>
        <p class="url-status__title app-heading">画像の候補が見つかりませんでした</p>
        <p class="url-status__message">
          このページには保存できる漫画画像が見つからなかったよ。別のページのURLを試してね。
        </p>
        <button
          class="app-btn app-btn--secondary app-btn--block"
          type="button"
          @click="returnToUrlInput"
        >
          URLを直す
        </button>
      </div>
    </section>

    <template v-else-if="imageCandidateListState.kind === 'populated'">
      <!-- ステップ2：画像確認 -->
      <section
        v-if="saveStage === 'image'"
        class="image-step"
        aria-labelledby="image-candidates-heading"
      >
        <div class="image-step__heading">
          <h2 id="image-candidates-heading" class="image-step__count">
            <strong>{{ imageCandidateSelectionState.selectedCount }}枚</strong>を選択中
            <span class="image-step__total">/ {{ imageCandidateSelectionState.totalCount }}枚</span>
          </h2>
          <div class="image-step__bulk" aria-label="画像候補の一括選択">
            <button
              class="app-btn app-btn--text"
              type="button"
              :disabled="
                imageCandidateSelectionState.selectedCount ===
                imageCandidateSelectionState.totalCount
              "
              @click="selectAllCandidates"
            >
              全選択
            </button>
            <button
              class="app-btn app-btn--text"
              type="button"
              :disabled="imageCandidateSelectionState.selectedCount === 0"
              @click="clearAllCandidateSelections"
            >
              全解除
            </button>
          </div>
        </div>

        <p class="visually-hidden" aria-live="polite">{{ orderAnnouncement }}</p>
        <ul class="candidate-grid">
          <li v-for="(candidate, index) in displayedImageCandidates" :key="candidate.id">
            <label
              class="candidate-card"
              :class="{
                'candidate-card--selected':
                  candidate.isSelected && candidateFailureKind(candidate) === undefined,
                'candidate-card--preview-failed': candidateFailureKind(candidate) === 'preview',
                'candidate-card--save-failed': candidateFailureKind(candidate) === 'save',
              }"
            >
              <input
                class="visually-hidden"
                type="checkbox"
                :checked="candidate.isSelected"
                @change="toggleCandidate(candidate.id)"
              />
              <span class="candidate-card__media">
                <img
                  v-if="candidateFailureKind(candidate) === undefined"
                  class="candidate-card__image"
                  :src="getCandidatePreviewUrl(candidate)"
                  :alt="`画像候補 ${candidate.domOrder + 1}`"
                  :loading="getPreviewImageLoading(index)"
                  :fetchpriority="getPreviewImageFetchPriority(index)"
                  decoding="async"
                  @error="onPreviewError(candidate.id)"
                />
                <span v-else class="candidate-card__failure">
                  <AppIcon :path="mdiAlertOutline" :size="24" />
                  {{ candidateFailureKind(candidate) === 'save' ? '保存に失敗' : '読み込み失敗' }}
                </span>
              </span>
              <span class="candidate-card__check" aria-hidden="true">
                <AppIcon v-if="candidate.isSelected" :path="mdiCheck" :size="16" />
              </span>
              <span class="candidate-card__number">{{ candidate.domOrder + 1 }}</span>
              <span class="candidate-card__size">
                {{
                  candidate.width !== undefined && candidate.height !== undefined
                    ? `${candidate.width} × ${candidate.height}`
                    : 'サイズ不明'
                }}
              </span>
              <span class="visually-hidden">
                {{ candidate.isSelected ? '選択済み' : '未選択' }}
              </span>
            </label>
            <div v-if="candidate.isSelected" class="candidate-order">
              <span class="candidate-order__position">
                保存順 {{ getSelectedOrderIndex(candidate.id) + 1 }}
              </span>
              <button
                class="candidate-order__button"
                type="button"
                :disabled="getSelectedOrderIndex(candidate.id) === 0"
                :aria-label="`画像候補 ${candidate.domOrder + 1} を保存順で1つ前へ移動`"
                :title="
                  getSelectedOrderIndex(candidate.id) === 0
                    ? '先頭の画像は上へ移動できません'
                    : '保存順を1つ前へ'
                "
                @click="moveCandidate(candidate.id, 'previous')"
              >
                <AppIcon :path="mdiChevronUp" :size="24" />
              </button>
              <button
                class="candidate-order__button"
                type="button"
                :disabled="
                  getSelectedOrderIndex(candidate.id) === selectedCandidateOrder.length - 1
                "
                :aria-label="`画像候補 ${candidate.domOrder + 1} を保存順で1つ後ろへ移動`"
                :title="
                  getSelectedOrderIndex(candidate.id) === selectedCandidateOrder.length - 1
                    ? '末尾の画像は下へ移動できません'
                    : '保存順を1つ後ろへ'
                "
                @click="moveCandidate(candidate.id, 'next')"
              >
                <AppIcon :path="mdiChevronDown" :size="24" />
              </button>
            </div>
          </li>
        </ul>

        <button
          class="app-btn app-btn--primary app-btn--block image-step__next"
          type="button"
          :disabled="!imageCandidateSelectionState.canSave"
          @click="proceedToInfo"
        >
          {{ imageCandidateSelectionState.selectedCount }}枚で次へ
        </button>
      </section>

      <!-- ステップ3：情報入力 -->
      <section v-else class="registration-step" aria-labelledby="registration-heading">
        <h2 id="registration-heading" class="registration-step__heading">登録方法</h2>

        <div class="registration-mode" role="radiogroup" aria-label="登録方法">
          <button
            v-for="option in registrationModeOptions"
            :key="option.value"
            class="app-choice"
            :class="{ 'app-choice--selected': registrationMode === option.value }"
            type="button"
            :disabled="isSavingAnalyzedPage"
            role="radio"
            :aria-checked="registrationMode === option.value"
            @click="selectRegistrationMode(option.value)"
          >
            <span class="registration-mode__radio" aria-hidden="true"></span>
            {{ option.label }}
          </button>
        </div>

        <aside
          v-if="
            metadataSuggestions.pageTitle ||
            metadataSuggestions.seriesTitle ||
            metadataSuggestions.episodeTitle ||
            metadataSuggestions.episodeNumber !== undefined
          "
          class="metadata-suggestions"
          aria-label="ページから推定した候補"
        >
          <strong>ページからの候補</strong>
          <small v-if="metadataSuggestions.pageTitle">
            {{ metadataSuggestions.pageTitle }}
          </small>
          <div class="metadata-suggestions__actions">
            <button
              v-if="registrationMode === 'newSeries' && metadataSuggestions.seriesTitle"
              class="app-btn app-btn--text"
              type="button"
              @click="applySeriesTitleSuggestion"
            >
              作品名：{{ metadataSuggestions.seriesTitle }}
            </button>
            <button
              v-if="metadataSuggestions.episodeTitle"
              class="app-btn app-btn--text"
              type="button"
              @click="applyEpisodeTitleSuggestion"
            >
              話タイトル：{{ metadataSuggestions.episodeTitle }}
            </button>
            <button
              v-if="metadataSuggestions.episodeNumber !== undefined"
              class="app-btn app-btn--text"
              type="button"
              @click="applyEpisodeNumberSuggestion"
            >
              話数：第{{ metadataSuggestions.episodeNumber }}話
            </button>
          </div>
          <span>候補は自由に修正できます。保存前に内容を確認してください。</span>
        </aside>

        <form
          v-if="registrationMode === 'newSeries'"
          class="registration-fields"
          aria-label="新規作品の入力項目"
          @submit.prevent="saveCurrentRegistration()"
        >
          <label class="app-field-label">
            <span>作品名</span>
            <input
              v-model="newSeriesTitle"
              class="app-field"
              name="seriesTitle"
              type="text"
              :aria-invalid="showRegistrationErrors && newSeriesTitle.trim() === ''"
            />
          </label>
          <label class="app-field-label">
            <span>話タイトル</span>
            <input
              v-model="newSeriesEpisodeTitle"
              class="app-field"
              name="title"
              type="text"
              :aria-invalid="showRegistrationErrors && newSeriesEpisodeTitle.trim() === ''"
            />
          </label>
          <label class="app-field-label">
            <span>話数（任意）</span>
            <input
              v-model.number="newSeriesEpisodeNumber"
              class="app-field"
              name="episodeNumber"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
            />
          </label>
          <label class="app-field-label">
            <span>元ページURL</span>
            <input
              v-model="newSeriesSourcePageUrl"
              class="app-field"
              name="sourcePageUrl"
              type="url"
              :aria-invalid="showRegistrationErrors && newSeriesSourcePageUrl.trim() === ''"
            />
          </label>
          <button
            class="app-btn app-btn--primary app-btn--block"
            :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
            type="submit"
          >
            この内容で保存する
          </button>
        </form>

        <form
          v-else-if="registrationMode === 'standaloneEpisode'"
          class="registration-fields"
          aria-label="単独の話の入力項目"
          @submit.prevent="saveCurrentRegistration()"
        >
          <label class="app-field-label">
            <span>話タイトル</span>
            <input
              v-model="standaloneEpisodeTitle"
              class="app-field"
              name="title"
              type="text"
              :aria-invalid="showRegistrationErrors && standaloneEpisodeTitle.trim() === ''"
            />
          </label>
          <label class="app-field-label">
            <span>話数（任意）</span>
            <input
              v-model.number="standaloneEpisodeNumber"
              class="app-field"
              name="episodeNumber"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
            />
          </label>
          <label class="app-field-label">
            <span>元ページURL</span>
            <input
              v-model="standaloneEpisodeSourcePageUrl"
              class="app-field"
              name="sourcePageUrl"
              type="url"
              :aria-invalid="showRegistrationErrors && standaloneEpisodeSourcePageUrl.trim() === ''"
            />
          </label>
          <button
            class="app-btn app-btn--primary app-btn--block"
            :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
            type="submit"
          >
            {{ 'この内容で保存する' }}
          </button>
        </form>

        <form
          v-else
          class="registration-fields"
          aria-label="既存作品への話追加の入力項目"
          @submit.prevent="saveCurrentRegistration()"
        >
          <div v-if="existingSeriesSuggestions.length > 0" class="series-suggestions">
            <strong>追加先の候補</strong>
            <button
              v-for="suggestion in existingSeriesSuggestions"
              :key="suggestion.series.id"
              class="app-btn app-btn--text"
              type="button"
              @click="applyExistingSeriesSuggestion(suggestion.series.id)"
            >
              {{ suggestion.series.title }}
              <small>
                {{
                  suggestion.reasons.includes('exact-title')
                    ? '作品名が一致'
                    : '同じサイト・URL構造'
                }}
              </small>
            </button>
          </div>
          <label class="app-field-label">
            <span>追加先作品</span>
            <select
              v-model="existingSeriesId"
              class="app-field"
              name="seriesId"
              :aria-invalid="showRegistrationErrors && existingSeriesId.trim() === ''"
            >
              <option value="">作品を選択してください</option>
              <option v-for="series in seriesOptions" :key="series.id" :value="series.id">
                {{ series.title }}
              </option>
            </select>
          </label>
          <label class="app-field-label">
            <span>話タイトル</span>
            <input
              v-model="existingSeriesEpisodeTitle"
              class="app-field"
              name="title"
              type="text"
              :aria-invalid="showRegistrationErrors && existingSeriesEpisodeTitle.trim() === ''"
            />
          </label>
          <label class="app-field-label">
            <span>話数（任意）</span>
            <input
              v-model.number="existingSeriesEpisodeNumber"
              class="app-field"
              name="episodeNumber"
              type="number"
              min="0"
              step="1"
              inputmode="numeric"
            />
          </label>
          <label class="app-field-label">
            <span>元ページURL</span>
            <input
              v-model="existingSeriesEpisodeSourcePageUrl"
              class="app-field"
              name="sourcePageUrl"
              type="url"
              :aria-invalid="
                showRegistrationErrors && existingSeriesEpisodeSourcePageUrl.trim() === ''
              "
            />
          </label>
          <button
            class="app-btn app-btn--primary app-btn--block"
            :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
            type="submit"
          >
            {{ 'この内容で保存する' }}
          </button>
        </form>

        <p
          v-if="showRegistrationErrors && !registrationFieldsComplete"
          class="registration-required"
          role="alert"
        >
          必須項目を入力してください。
        </p>
        <p v-else-if="saveFlowError" class="app-message app-message--error" role="alert">
          {{ saveFlowError }}
        </p>
      </section>
    </template>

    <!-- URL重複警告（納品デザイン12） -->
    <div
      v-if="duplicateWarning"
      class="duplicate-warning"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-warning-title"
    >
      <div class="duplicate-warning__panel">
        <div class="duplicate-warning__icon" aria-hidden="true">
          <AppIcon :path="mdiAlertOutline" :size="32" />
        </div>
        <h2 id="duplicate-warning-title" class="app-heading duplicate-warning__title">
          このURLは既に登録されています
        </h2>
        <p class="duplicate-warning__message">
          同じ元ページのURLがすでに保存されているよ。内容が更新されている場合や別の画像を選びたい場合は、重複して保存できるよ。
        </p>
        <ul class="duplicate-warning__list">
          <li v-for="registration in duplicateWarning" :key="registration.episodeId">
            <strong>{{ registration.title }}</strong>
            <span>登録日時：{{ registration.registeredAtLabel }}</span>
          </li>
        </ul>
        <div class="duplicate-warning__actions">
          <button
            class="app-btn app-btn--secondary app-btn--block"
            type="button"
            @click="cancelDuplicateSave"
          >
            キャンセル
          </button>
          <button
            class="app-btn app-btn--primary app-btn--block"
            type="button"
            @click="confirmDuplicateSave"
          >
            重複して保存
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="duplicateImageWarning"
      class="duplicate-warning"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-image-warning-title"
    >
      <div class="duplicate-warning__panel">
        <div class="duplicate-warning__icon" aria-hidden="true">
          <AppIcon :path="mdiAlertOutline" :size="32" />
        </div>
        <h2 id="duplicate-image-warning-title" class="app-heading duplicate-warning__title">
          同じ画像が見つかりました
        </h2>
        <p class="duplicate-warning__message">
          {{ duplicateImageWarning.length }}件の重複候補があります。既存画像は変更されません。
        </p>
        <ul class="duplicate-warning__list">
          <li
            v-for="(match, index) in duplicateImageWarning"
            :key="`${match.incomingIndex}-${index}`"
          >
            <strong>選択画像 {{ match.incomingIndex + 1 }}</strong>
            <span v-if="match.target.kind === 'batch'">
              今回の選択画像 {{ match.target.imageIndex + 1 }} と重複
            </span>
            <span v-else>
              {{
                match.target.seriesTitle
                  ? `${match.target.seriesTitle} / ${match.target.episodeTitle}`
                  : match.target.episodeTitle
              }}（{{ match.target.imagePosition }}枚目）
            </span>
            <span>
              {{ match.reasons.includes('same-content') ? '画像内容が一致' : '元画像URLが一致' }}
            </span>
          </li>
        </ul>
        <div class="duplicate-warning__actions">
          <button
            class="app-btn app-btn--secondary app-btn--block"
            type="button"
            @click="cancelDuplicateImageSave"
          >
            画像選択へ戻る
          </button>
          <button
            class="app-btn app-btn--primary app-btn--block"
            type="button"
            @click="confirmDuplicateImageSave"
          >
            重複を含めて保存
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.save-view {
  display: grid;
  gap: var(--app-space-md);
}

.save-header {
  display: flex;
  align-items: center;
  gap: var(--app-space-2xs);
}

.save-header__back {
  margin-left: calc(var(--app-space-2xs) * -1);
}

.save-header__title {
  margin: 0;
}

h2 {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

/* ---- ステップ1：URL入力 ---- */
.url-step {
  display: grid;
  gap: var(--app-space-sm);
}

.url-step__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

.url-step__description {
  margin: 0;
  color: var(--app-color-text-muted);
}

.save-privacy {
  display: flex;
  gap: var(--app-space-2xs);
  align-items: flex-start;
  margin: 0;
  padding: var(--app-space-xs) var(--app-space-sm);
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-md);
}

.save-privacy__icon {
  flex: 0 0 auto;
  margin-top: 0.125rem;
}

/* オフライン中の保存不可の案内 */
.save-offline {
  display: flex;
  gap: var(--app-space-2xs);
  align-items: flex-start;
  margin: 0;
  padding: var(--app-space-xs) var(--app-space-sm);
  color: var(--app-color-text);
  font-size: var(--app-font-size-sm);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-md);
}

.save-offline__icon {
  flex: 0 0 auto;
  margin-top: 0.125rem;
  color: var(--app-color-text-muted);
}

/* 解析中・取得失敗・候補なしの中央寄せ表示 */
.url-status {
  display: grid;
  justify-items: center;
  gap: var(--app-space-2xs);
  padding: var(--app-space-xl) var(--app-space-sm);
  text-align: center;
}

.url-status__icon {
  display: grid;
  place-items: center;
  width: 5rem;
  height: 5rem;
  margin-bottom: var(--app-space-2xs);
  color: var(--app-color-text-muted);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-xl);
}

.url-status__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

.url-status__message {
  max-width: 20rem;
  margin: 0 0 var(--app-space-2xs);
  color: var(--app-color-text-muted);
}

.url-status__url {
  margin: 0 0 var(--app-space-sm);
  overflow-wrap: anywhere;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.url-status .app-btn {
  width: 100%;
  max-width: 22rem;
}

.save-spinner {
  width: 3rem;
  height: 3rem;
  margin-bottom: var(--app-space-2xs);
  border: 0.25rem solid var(--app-color-border);
  border-top-color: var(--app-color-primary);
  border-radius: var(--app-radius-pill);
  animation: save-spinner-rotate 0.9s linear infinite;
}

@keyframes save-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-spinner {
    animation-duration: 2.4s;
  }
}

/* ---- ステップ2以降 ---- */
.save-view__description {
  margin: 0;
  color: var(--app-color-text-muted);
}

.registration-mode {
  display: grid;
  gap: var(--app-space-2xs);
}

.registration-step {
  display: grid;
  gap: var(--app-space-sm);
}

.registration-step__heading {
  font-family: var(--app-font-family-sans);
  font-size: var(--app-font-size-sm);
  font-weight: var(--app-font-weight-semibold);
}

.registration-mode__radio {
  width: 1.25rem;
  height: 1.25rem;
  border: 0.125rem solid var(--app-color-border);
  border-radius: var(--app-radius-pill);
}

.app-choice--selected .registration-mode__radio {
  border: 0.375rem solid var(--app-color-primary);
}

.registration-fields {
  display: grid;
  gap: var(--app-space-xs);
}

.metadata-suggestions,
.series-suggestions {
  display: grid;
  gap: var(--app-space-2xs);
  padding: var(--app-space-xs);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-md);
}

.metadata-suggestions small,
.metadata-suggestions > span,
.series-suggestions small {
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.metadata-suggestions__actions {
  display: grid;
  justify-items: start;
  gap: var(--app-space-3xs);
}

.metadata-suggestions .app-btn--text,
.series-suggestions .app-btn--text {
  justify-content: flex-start;
  min-height: 2.75rem;
  padding-inline: var(--app-space-2xs);
  text-align: left;
}

.series-suggestions .app-btn--text {
  display: grid;
  justify-items: start;
}

.registration-required {
  margin: 0;
  color: var(--app-color-error);
  font-size: var(--app-font-size-sm);
  font-weight: var(--app-font-weight-semibold);
}

/* ---- ステップ4：保存中 ---- */
.saving-state,
.complete-state {
  display: grid;
  align-content: center;
  justify-items: center;
  width: 100%;
  min-width: 0;
  min-height: calc(100dvh - 8rem);
  text-align: center;
}

.saving-state {
  gap: var(--app-space-xs);
  color: var(--app-color-text-muted);
}

.saving-state p {
  margin: 0;
}

.saving-state__spinner {
  width: 5.75rem;
  height: 5.75rem;
  margin-bottom: var(--app-space-md);
  border: 0.5rem solid var(--app-color-panel);
  border-top-color: var(--app-color-primary);
  border-right-color: var(--app-color-primary);
  border-radius: var(--app-radius-pill);
  animation: save-spinner-rotate 1.2s linear infinite;
}

.saving-state__title {
  margin: 0;
  color: var(--app-color-text);
  font-size: var(--app-font-size-xl);
}

.saving-state__wait,
.saving-state__lock {
  color: var(--app-color-text-subtle);
  font-size: var(--app-font-size-sm);
}

.saving-state__bar {
  display: block;
  width: 100%;
  max-width: 20rem;
  height: 0.5rem;
  margin-top: var(--app-space-md);
  overflow: hidden;
  background: var(--app-color-panel);
  border-radius: var(--app-radius-pill);
}

.saving-state__bar span {
  display: block;
  width: 45%;
  height: 100%;
  background: var(--app-color-primary);
  border-radius: inherit;
  animation: saving-bar 1.5s ease-in-out infinite alternate;
}

.saving-state__lock {
  display: flex;
  align-items: center;
  gap: var(--app-space-3xs);
}

@keyframes saving-bar {
  to {
    transform: translateX(122%);
  }
}

/* ---- ステップ4：完了 ---- */
.complete-state {
  gap: var(--app-space-xs);
}

.complete-state__check {
  display: grid;
  place-items: center;
  width: 5.25rem;
  height: 5.25rem;
  margin-bottom: var(--app-space-sm);
  color: var(--app-color-on-primary);
  background: var(--app-color-primary);
  border-radius: var(--app-radius-pill);
}

.complete-state__title {
  margin: 0;
  font-size: var(--app-font-size-xl);
}

.complete-state__summary {
  margin: 0 0 var(--app-space-sm);
  color: var(--app-color-text-muted);
  line-height: 1.7;
}

.complete-state__card {
  display: flex;
  align-items: center;
  gap: var(--app-space-xs);
  width: 100%;
  max-width: 22rem;
  padding: var(--app-space-xs);
  margin-bottom: var(--app-space-sm);
  text-align: left;
  background: var(--app-color-surface);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-lg);
}

.complete-state__thumbnail {
  width: 3rem;
  height: 4rem;
  background: var(--app-color-text-muted);
  border-radius: var(--app-radius-sm);
}

.complete-state__card span:last-child {
  display: grid;
  min-width: 0;
}

.complete-state__card small {
  margin-top: var(--app-space-3xs);
  color: var(--app-color-text-muted);
}

.complete-state > .app-btn {
  width: 100%;
  max-width: 22rem;
}

/* ---- ステップ2：画像確認 ---- */
.image-step {
  display: grid;
  gap: var(--app-space-sm);
}

.image-step__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-2xs);
}

.image-step__count {
  margin: 0;
  font-size: var(--app-font-size-md);
  font-weight: var(--app-font-weight-medium);
}

.image-step__count strong {
  font-size: var(--app-font-size-lg);
}

.image-step__total {
  color: var(--app-color-text-muted);
}

.image-step__bulk {
  display: flex;
  gap: var(--app-space-2xs);
}

.candidate-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--app-space-2xs);
  padding: 0;
  margin: 0;
  list-style: none;
}

.candidate-card {
  position: relative;
  display: block;
  overflow: hidden;
  border: 0.125rem solid transparent;
  border-radius: var(--app-radius-md);
  cursor: pointer;
}

.candidate-card:focus-within {
  outline: 0.1875rem solid var(--app-color-primary);
  outline-offset: 0.125rem;
}

.candidate-card--selected {
  border-color: var(--app-color-primary);
}

.candidate-card--save-failed {
  border-color: var(--app-color-error);
}

.candidate-card__media {
  display: block;
  aspect-ratio: 3 / 4;
  background: var(--app-color-panel);
}

.candidate-card__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.candidate-card__failure {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--app-space-3xs);
  width: 100%;
  height: 100%;
  padding: var(--app-space-2xs);
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-xs);
  text-align: center;
}

.candidate-card--save-failed .candidate-card__failure {
  color: var(--app-color-error);
  font-weight: var(--app-font-weight-bold);
}

/* 選択チェック（右上） */
.candidate-card__check {
  position: absolute;
  top: var(--app-space-3xs);
  right: var(--app-space-3xs);
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  color: var(--app-color-on-primary);
  background: var(--app-color-surface);
  border: 0.125rem solid var(--app-color-surface);
  border-radius: var(--app-radius-pill);
}

.candidate-card--selected .candidate-card__check {
  background: var(--app-color-primary);
  border-color: var(--app-color-primary);
}

/* DOM順の番号（左下） */
.candidate-card__number {
  position: absolute;
  bottom: var(--app-space-3xs);
  left: var(--app-space-3xs);
  min-width: 1.25rem;
  padding: 0 0.3125rem;
  color: var(--app-color-on-cta);
  font-size: var(--app-font-size-xs);
  font-weight: var(--app-font-weight-bold);
  text-align: center;
  background: rgba(0, 0, 0, 55%);
  border-radius: var(--app-radius-sm);
}

/* 幅・高さ（右下） */
.candidate-card__size {
  position: absolute;
  right: var(--app-space-3xs);
  bottom: var(--app-space-3xs);
  padding: 0 0.3125rem;
  color: var(--app-color-on-cta);
  font-size: 0.6875rem;
  background: rgba(0, 0, 0, 55%);
  border-radius: var(--app-radius-sm);
}

.candidate-order {
  display: grid;
  grid-template-columns: 1fr 2.75rem 2.75rem;
  align-items: center;
  gap: var(--app-space-3xs);
  margin-top: var(--app-space-3xs);
}

.candidate-order__position {
  overflow: hidden;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-order__button {
  display: grid;
  place-items: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  padding: 0;
  color: var(--app-color-primary);
  background: var(--app-color-surface);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-md);
}

.candidate-order__button:disabled {
  color: var(--app-color-text-muted);
  cursor: not-allowed;
  opacity: 0.55;
}

.candidate-order__button:focus-visible {
  outline: 0.1875rem solid var(--app-color-primary);
  outline-offset: 0.125rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ---- URL重複警告 ---- */
.duplicate-warning {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--app-space-md);
  background: rgba(0, 0, 0, 45%);
}

.duplicate-warning__panel {
  display: grid;
  justify-items: center;
  gap: var(--app-space-xs);
  width: 100%;
  max-width: 24rem;
  max-height: calc(100dvh - var(--app-space-md) - var(--app-space-md));
  padding: var(--app-space-lg) var(--app-space-md);
  overflow-y: auto;
  overscroll-behavior: contain;
  text-align: center;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-lg);
}

.duplicate-warning__icon {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  color: var(--app-color-error);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-pill);
}

.duplicate-warning__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

.duplicate-warning__message {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.duplicate-warning__list {
  display: grid;
  gap: var(--app-space-2xs);
  width: 100%;
  padding: var(--app-space-xs);
  margin: 0;
  text-align: left;
  list-style: none;
  background: var(--app-color-panel);
  border-radius: var(--app-radius-md);
}

.duplicate-warning__list li {
  display: grid;
  gap: var(--app-space-3xs);
}

.duplicate-warning__list span {
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.duplicate-warning__actions {
  display: grid;
  gap: var(--app-space-2xs);
  width: 100%;
  margin-top: var(--app-space-2xs);
}
</style>
