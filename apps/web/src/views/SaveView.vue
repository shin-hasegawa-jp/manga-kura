<script setup lang="ts">
import { computed, ref } from 'vue'
import { useExistingSeriesEpisodeRegistration } from '@/composables/useExistingSeriesEpisodeRegistration'
import { useNewSeriesRegistration } from '@/composables/useNewSeriesRegistration'
import { useStandaloneEpisodeRegistration } from '@/composables/useStandaloneEpisodeRegistration'
import type { RegistrationImage } from '@/database/registrationService'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import { createProxiedImageUrl } from '@/services/acquisitionApiClient'
import { createSelectedImageBlobFetcher } from '@/services/imageBlobClient'
import { analyzePageImages, type PageImageAnalysisState } from '@/services/pageImageAnalyzer'
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

  fetchAnalyzedImages = createSelectedImageBlobFetcher()
  saveFlowError.value = ''
  const result = await analyzePageImages(pageUrl.value, undefined, (state) => {
    pageImageAnalysisState.value = state
  })

  if (result.status === 'success' || result.status === 'empty') {
    pageUrl.value = result.pageUrl
    newSeriesSourcePageUrl.value = result.pageUrl
    standaloneEpisodeSourcePageUrl.value = result.pageUrl
    existingSeriesEpisodeSourcePageUrl.value = result.pageUrl
  }
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
    <h1>URL入力・保存</h1>

    <form
      class="page-url-form"
      aria-label="取得元ページURL"
      :aria-busy="imageCandidateListState.kind === 'loading'"
      @submit.prevent="analyzePageUrl"
    >
      <label class="app-field-label">
        <span>取得元ページURL</span>
        <input
          v-model="pageUrl"
          class="app-field"
          name="pageUrl"
          type="text"
          inputmode="url"
          autocomplete="url"
          placeholder="https://example.com/comic/1"
          :aria-invalid="imageCandidateListState.kind === 'failure'"
          :aria-describedby="
            imageCandidateListState.kind === 'failure' ? 'page-url-message' : undefined
          "
        />
      </label>
      <button
        class="app-btn app-btn--primary app-btn--block"
        :disabled="imageCandidateListState.kind === 'loading'"
        type="submit"
      >
        {{ imageCandidateListState.kind === 'loading' ? '解析中…' : '画像を解析' }}
      </button>
      <p
        v-if="imageCandidateListState.kind === 'failure'"
        id="page-url-message"
        class="app-message app-message--error"
        role="alert"
      >
        {{ imageCandidateListState.message }}
      </p>
    </form>

    <section
      v-if="imageCandidateListState.kind !== 'idle'"
      class="image-candidates"
      aria-labelledby="image-candidates-heading"
    >
      <div class="image-candidates__heading">
        <h2 id="image-candidates-heading">画像候補</h2>
        <span v-if="imageCandidateListState.kind === 'populated'">
          {{ imageCandidateSelectionState.selectedCount }} /
          {{ imageCandidateSelectionState.totalCount }}件を選択
        </span>
      </div>

      <p v-if="imageCandidateListState.kind === 'loading'" role="status">
        ページから画像候補を解析しています…
      </p>
      <p v-else-if="imageCandidateListState.kind === 'empty'" class="app-message app-message--info">
        {{ imageCandidateListState.message }}
      </p>
      <template v-else-if="imageCandidateListState.kind === 'populated'">
        <div class="image-candidates__selection-actions" aria-label="画像候補の一括選択">
          <button
            class="app-btn app-btn--text"
            type="button"
            :disabled="
              imageCandidateSelectionState.selectedCount === imageCandidateSelectionState.totalCount
            "
            @click="selectAllCandidates"
          >
            すべて選択
          </button>
          <button
            class="app-btn app-btn--text"
            type="button"
            :disabled="imageCandidateSelectionState.selectedCount === 0"
            @click="clearAllCandidateSelections"
          >
            すべて解除
          </button>
        </div>
        <ul class="image-candidate-list">
          <li
            v-for="candidate in imageCandidateListState.candidates"
            :key="candidate.id"
            class="image-candidate"
            :class="{ 'image-candidate--failed': candidate.fetchStatus === 'failed' }"
          >
            <img
              v-if="candidate.fetchStatus !== 'failed'"
              class="image-candidate__preview"
              :src="getCandidatePreviewUrl(candidate)"
              :alt="`画像候補 ${candidate.domOrder + 1}`"
            />
            <div v-else class="image-candidate__preview image-candidate__preview--failed">
              読込失敗
            </div>
            <div class="image-candidate__details">
              <label class="image-candidate__selection">
                <input
                  type="checkbox"
                  :checked="candidate.isSelected"
                  @change="toggleCandidate(candidate.id)"
                />
                <strong>候補 {{ candidate.domOrder + 1 }}</strong>
              </label>
              <span v-if="candidate.width !== undefined && candidate.height !== undefined">
                {{ candidate.width }} × {{ candidate.height }} px
              </span>
              <span v-else>サイズ取得不可</span>
              <span>{{ candidate.isSelected ? '選択済み' : '未選択' }}</span>
            </div>
          </li>
        </ul>
      </template>
    </section>

    <p class="save-view__description">保存する話の登録方法を選択してください。</p>

    <div class="registration-mode" aria-label="登録方法">
      <button
        v-for="option in registrationModeOptions"
        :key="option.value"
        class="app-choice registration-mode__button"
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
        <input v-model="newSeriesSourcePageUrl" class="app-field" name="sourcePageUrl" type="url" />
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
        {{ isSavingAnalyzedPage || isSubmittingStandaloneEpisode ? '保存中…' : '単独の話を登録' }}
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
        <input v-model="existingSeriesEpisodeTitle" class="app-field" name="title" type="text" />
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
          isSavingAnalyzedPage || isSubmittingExistingSeriesEpisode ? '保存中…' : '作品へ話を追加'
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
  </main>
</template>

<style scoped>
.save-view {
  display: grid;
  gap: var(--app-space-sm);
}

h1,
p {
  margin: 0;
}

h1 {
  font-size: var(--app-font-size-xl);
}

h2 {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

.save-view__description {
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

.page-url-form {
  display: grid;
  gap: var(--app-space-2xs);
  padding: var(--app-space-sm);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-md);
}

.image-candidates {
  display: grid;
  gap: var(--app-space-xs);
  padding: var(--app-space-sm);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-md);
}

.image-candidates__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.image-candidates__selection-actions {
  display: flex;
  gap: var(--app-space-2xs);
}

.image-candidate-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--app-space-xs);
  padding: 0;
  margin: 0;
  list-style: none;
}

.image-candidate {
  display: grid;
  gap: var(--app-space-2xs);
  min-width: 0;
  padding: var(--app-space-2xs);
  background: var(--app-color-surface);
  border: 0.125rem solid transparent;
  border-radius: var(--app-radius-md);
  box-shadow: 0 0 0 1px var(--app-color-border);
}

.image-candidate--failed {
  border-color: var(--app-color-error);
}

.image-candidate__preview {
  width: 100%;
  height: 12rem;
  object-fit: contain;
  background: rgba(var(--v-theme-on-surface), 5%);
  border-radius: var(--app-radius-sm);
}

.image-candidate__preview--failed {
  display: grid;
  place-items: center;
  color: var(--app-color-error);
  font-weight: var(--app-font-weight-bold);
}

.image-candidate__details {
  display: grid;
  gap: 0.125rem;
  font-size: 0.8125rem;
}

.image-candidate__selection {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  cursor: pointer;
}

.image-candidate__selection input {
  width: 1.25rem;
  height: 1.25rem;
  margin: 0;
}
</style>
