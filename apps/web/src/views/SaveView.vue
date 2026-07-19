<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  mdiAlertOutline,
  mdiCheck,
  mdiChevronLeft,
  mdiFileRemoveOutline,
  mdiImageSearchOutline,
  mdiShieldCheckOutline,
} from '@mdi/js'
import { useExistingSeriesEpisodeRegistration } from '@/composables/useExistingSeriesEpisodeRegistration'
import { useNewSeriesRegistration } from '@/composables/useNewSeriesRegistration'
import { useStandaloneEpisodeRegistration } from '@/composables/useStandaloneEpisodeRegistration'
import type { RegistrationImage } from '@/database/registrationService'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import { createProxiedImageUrl } from '@/services/acquisitionApiClient'
import { createSelectedImageBlobFetcher } from '@/services/imageBlobClient'
import { analyzePageImages, type PageImageAnalysisState } from '@/services/pageImageAnalyzer'
import AppIcon from '@/components/AppIcon.vue'
import SaveStepIndicator from '@/components/SaveStepIndicator.vue'
import { getSaveErrorPresentation, markImageFetchFailures } from './acquisitionErrorPresenter'
import { getImageCandidateListState } from './imageCandidateListState'
import {
  clearAllImageCandidateSelections,
  getImageCandidateSelectionState,
  selectAllImageCandidates,
  toggleImageCandidateSelection,
} from './imageCandidateSelection'
import { saveAnalyzedPage, type AnalyzedPageRegistrationDetails } from './saveAnalyzedPage'
import { registrationModeOptions, type RegistrationMode } from './saveRegistrationMode'

const registrationMode = ref<RegistrationMode>('newSeries')
const pageUrl = ref('')
const pageImageAnalysisState = ref<PageImageAnalysisState>()
const isSavingAnalyzedPage = ref(false)
const saveFlowError = ref('')
let fetchAnalyzedImages = createSelectedImageBlobFetcher()
// 進行中の解析を識別し、キャンセル・URL編集で古い解析結果を無視する
let analysisToken = 0
// 画像確認（ステップ2）と情報入力（ステップ3）の切り替え
const saveStage = ref<'image' | 'info'>('image')
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
  if (imageCandidateListState.value.kind !== 'populated') {
    return 1
  }
  return saveStage.value === 'info' ? 3 : 2
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
  newSeriesSourcePageUrl,
  newSeriesSubmission,
  isSubmittingNewSeries,
  registerNewSeries,
  resetNewSeriesFields,
  clearNewSeriesSubmission,
} = useNewSeriesRegistration()
const {
  standaloneEpisodeTitle,
  standaloneEpisodeSourcePageUrl,
  standaloneEpisodeSubmission,
  isSubmittingStandaloneEpisode,
  registerStandaloneEpisode,
  resetStandaloneEpisodeFields,
  clearStandaloneEpisodeSubmission,
} = useStandaloneEpisodeRegistration()
const {
  seriesOptions,
  existingSeriesId,
  existingSeriesEpisodeTitle,
  existingSeriesEpisodeSourcePageUrl,
  existingSeriesEpisodeSubmission,
  isSubmittingExistingSeriesEpisode,
  loadSeriesOptions,
  registerExistingSeriesEpisode,
  resetExistingSeriesEpisodeFields,
  clearExistingSeriesEpisodeSubmission,
} = useExistingSeriesEpisodeRegistration()

async function analyzePageUrl() {
  if (pageImageAnalysisState.value?.status === 'analyzing') {
    return
  }

  const token = ++analysisToken
  fetchAnalyzedImages = createSelectedImageBlobFetcher()
  saveFlowError.value = ''
  saveStage.value = 'image'
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
}

// 解析のキャンセル・URL編集への復帰（入力したURLは保持する）
function returnToUrlInput() {
  analysisToken += 1
  pageImageAnalysisState.value = undefined
  saveFlowError.value = ''
  saveStage.value = 'image'
  previewErrorIds.value = new Set()
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
        sourcePageUrl: newSeriesSourcePageUrl.value,
      }
    case 'standaloneEpisode':
      return {
        mode: 'standaloneEpisode',
        title: standaloneEpisodeTitle.value,
        sourcePageUrl: standaloneEpisodeSourcePageUrl.value,
      }
    case 'existingSeries':
      return {
        mode: 'existingSeries',
        seriesId: existingSeriesId.value,
        title: existingSeriesEpisodeTitle.value,
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

async function saveCurrentRegistration() {
  if (isSavingAnalyzedPage.value) {
    return
  }

  isSavingAnalyzedPage.value = true
  saveFlowError.value = ''

  try {
    const details = getCurrentRegistrationDetails()
    const result = await saveAnalyzedPage(pageImageAnalysisState.value, details, {
      fetchImages: fetchAnalyzedImages,
      register: (images) => registerMode(details.mode, images),
    })

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
      return
    }

    pageUrl.value = ''
    pageImageAnalysisState.value = undefined
    fetchAnalyzedImages = createSelectedImageBlobFetcher()
    saveStage.value = 'image'
    previewErrorIds.value = new Set()
    resetNewSeriesFields()
    resetStandaloneEpisodeFields()
    resetExistingSeriesEpisodeFields()
  } finally {
    isSavingAnalyzedPage.value = false
  }
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
  updateImageCandidates((candidates) => toggleImageCandidateSelection(candidates, candidateId))
}

function selectAllCandidates() {
  updateImageCandidates(selectAllImageCandidates)
}

function clearAllCandidateSelections() {
  updateImageCandidates(clearAllImageCandidateSelections)
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

  if (mode === 'existingSeries') {
    void loadSeriesOptions()
  }
}
</script>

<template>
  <main class="save-view">
    <header class="save-header">
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

    <SaveStepIndicator :current="currentStep" />

    <!-- ステップ1：URL入力 -->
    <section v-if="currentStep === 1" aria-label="URL入力">
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
        <button class="app-btn app-btn--primary app-btn--block" type="submit">
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

        <ul class="candidate-grid">
          <li v-for="candidate in imageCandidateListState.candidates" :key="candidate.id">
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

      <!-- ステップ3：情報入力（詳細はレビュー単位26で反映） -->
      <template v-else>
        <p class="save-view__description">保存する話の登録方法を選択してください。</p>

        <div class="registration-mode" aria-label="登録方法">
          <button
            v-for="option in registrationModeOptions"
            :key="option.value"
            class="app-choice"
            :class="{ 'app-choice--selected': registrationMode === option.value }"
            type="button"
            :disabled="isSavingAnalyzedPage"
            :aria-pressed="registrationMode === option.value"
            @click="selectRegistrationMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <form
          v-if="registrationMode === 'newSeries'"
          class="registration-fields"
          aria-label="新規作品の入力項目"
          @submit.prevent="saveCurrentRegistration"
        >
          <label class="app-field-label">
            <span>作品名</span>
            <input v-model="newSeriesTitle" class="app-field" name="seriesTitle" type="text" />
          </label>
          <label class="app-field-label">
            <span>話タイトル</span>
            <input v-model="newSeriesEpisodeTitle" class="app-field" name="title" type="text" />
          </label>
          <label class="app-field-label">
            <span>元ページURL</span>
            <input
              v-model="newSeriesSourcePageUrl"
              class="app-field"
              name="sourcePageUrl"
              type="url"
            />
          </label>
          <button
            class="app-btn app-btn--primary app-btn--block"
            :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
            type="submit"
          >
            {{ isSavingAnalyzedPage || isSubmittingNewSeries ? '保存中…' : '新規作品を登録' }}
          </button>
          <p
            v-if="newSeriesSubmission"
            class="app-message"
            :class="`app-message--${newSeriesSubmission.status}`"
            role="status"
          >
            {{ newSeriesSubmission.message }}
          </p>
        </form>

        <form
          v-else-if="registrationMode === 'standaloneEpisode'"
          class="registration-fields"
          aria-label="単独の話の入力項目"
          @submit.prevent="saveCurrentRegistration"
        >
          <label class="app-field-label">
            <span>話タイトル</span>
            <input v-model="standaloneEpisodeTitle" class="app-field" name="title" type="text" />
          </label>
          <label class="app-field-label">
            <span>元ページURL</span>
            <input
              v-model="standaloneEpisodeSourcePageUrl"
              class="app-field"
              name="sourcePageUrl"
              type="url"
            />
          </label>
          <button
            class="app-btn app-btn--primary app-btn--block"
            :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
            type="submit"
          >
            {{
              isSavingAnalyzedPage || isSubmittingStandaloneEpisode ? '保存中…' : '単独の話を登録'
            }}
          </button>
          <p
            v-if="standaloneEpisodeSubmission"
            class="app-message"
            :class="`app-message--${standaloneEpisodeSubmission.status}`"
            role="status"
          >
            {{ standaloneEpisodeSubmission.message }}
          </p>
        </form>

        <form
          v-else
          class="registration-fields"
          aria-label="既存作品への話追加の入力項目"
          @submit.prevent="saveCurrentRegistration"
        >
          <label class="app-field-label">
            <span>追加先作品</span>
            <select v-model="existingSeriesId" class="app-field" name="seriesId">
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
            />
          </label>
          <label class="app-field-label">
            <span>元ページURL</span>
            <input
              v-model="existingSeriesEpisodeSourcePageUrl"
              class="app-field"
              name="sourcePageUrl"
              type="url"
            />
          </label>
          <button
            class="app-btn app-btn--primary app-btn--block"
            :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
            type="submit"
          >
            {{
              isSavingAnalyzedPage || isSubmittingExistingSeriesEpisode
                ? '保存中…'
                : '作品へ話を追加'
            }}
          </button>
          <p
            v-if="existingSeriesEpisodeSubmission"
            class="app-message"
            :class="`app-message--${existingSeriesEpisodeSubmission.status}`"
            role="status"
          >
            {{ existingSeriesEpisodeSubmission.message }}
          </p>
        </form>

        <p v-if="saveFlowError" class="app-message app-message--error" role="alert">
          {{ saveFlowError }}
        </p>
      </template>
    </template>
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

.registration-fields {
  display: grid;
  gap: var(--app-space-2xs);
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
</style>
