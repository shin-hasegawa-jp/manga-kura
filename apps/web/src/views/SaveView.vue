<script setup lang="ts">
import { computed, ref } from 'vue'
import { useExistingSeriesEpisodeRegistration } from '@/composables/useExistingSeriesEpisodeRegistration'
import { useNewSeriesRegistration } from '@/composables/useNewSeriesRegistration'
import { useStandaloneEpisodeRegistration } from '@/composables/useStandaloneEpisodeRegistration'
import type { RegistrationImage } from '@/database/registrationService'
import type { ImageCandidate } from '@/services/imageCandidateFactory'
import { analyzePageImages, type PageImageAnalysisState } from '@/services/pageImageAnalyzer'
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
      register: (images) => registerMode(details.mode, images),
    })

    if (result.status === 'error') {
      saveFlowError.value = result.message
      return
    }

    pageUrl.value = ''
    pageImageAnalysisState.value = undefined
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
      <label class="registration-fields__label">
        <span>取得元ページURL</span>
        <input
          v-model="pageUrl"
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
        class="registration-submit"
        :disabled="imageCandidateListState.kind === 'loading'"
        type="submit"
      >
        {{ imageCandidateListState.kind === 'loading' ? '解析中…' : '画像を解析' }}
      </button>
      <p
        v-if="imageCandidateListState.kind === 'failure'"
        id="page-url-message"
        class="registration-message registration-message--error"
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
      <p v-else-if="imageCandidateListState.kind === 'empty'" class="image-candidates__empty">
        このページから画像候補を抽出できませんでした。
      </p>
      <template v-else-if="imageCandidateListState.kind === 'populated'">
        <div class="image-candidates__selection-actions" aria-label="画像候補の一括選択">
          <button
            type="button"
            :disabled="
              imageCandidateSelectionState.selectedCount === imageCandidateSelectionState.totalCount
            "
            @click="selectAllCandidates"
          >
            すべて選択
          </button>
          <button
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
              :src="candidate.imageUrl"
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
        class="registration-mode__button"
        :class="{ 'registration-mode__button--selected': registrationMode === option.value }"
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
      <label class="registration-fields__label">
        <span>作品名</span>
        <input v-model="newSeriesTitle" name="seriesTitle" type="text" />
      </label>
      <label class="registration-fields__label">
        <span>話タイトル</span>
        <input v-model="newSeriesEpisodeTitle" name="title" type="text" />
      </label>
      <label class="registration-fields__label">
        <span>元ページURL</span>
        <input v-model="newSeriesSourcePageUrl" name="sourcePageUrl" type="url" />
      </label>
      <button
        class="registration-submit"
        :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
        type="submit"
      >
        {{ isSavingAnalyzedPage || isSubmittingNewSeries ? '保存中…' : '新規作品を登録' }}
      </button>
      <p
        v-if="newSeriesSubmission"
        class="registration-message"
        :class="`registration-message--${newSeriesSubmission.status}`"
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
      <label class="registration-fields__label">
        <span>話タイトル</span>
        <input v-model="standaloneEpisodeTitle" name="title" type="text" />
      </label>
      <label class="registration-fields__label">
        <span>元ページURL</span>
        <input v-model="standaloneEpisodeSourcePageUrl" name="sourcePageUrl" type="url" />
      </label>
      <button
        class="registration-submit"
        :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
        type="submit"
      >
        {{ isSavingAnalyzedPage || isSubmittingStandaloneEpisode ? '保存中…' : '単独の話を登録' }}
      </button>
      <p
        v-if="standaloneEpisodeSubmission"
        class="registration-message"
        :class="`registration-message--${standaloneEpisodeSubmission.status}`"
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
      <label class="registration-fields__label">
        <span>追加先作品</span>
        <select v-model="existingSeriesId" name="seriesId">
          <option value="">作品を選択してください</option>
          <option v-for="series in seriesOptions" :key="series.id" :value="series.id">
            {{ series.title }}
          </option>
        </select>
      </label>
      <label class="registration-fields__label">
        <span>話タイトル</span>
        <input v-model="existingSeriesEpisodeTitle" name="title" type="text" />
      </label>
      <label class="registration-fields__label">
        <span>元ページURL</span>
        <input v-model="existingSeriesEpisodeSourcePageUrl" name="sourcePageUrl" type="url" />
      </label>
      <button
        class="registration-submit"
        :disabled="isSavingAnalyzedPage || !imageCandidateSelectionState.canSave"
        type="submit"
      >
        {{
          isSavingAnalyzedPage || isSubmittingExistingSeriesEpisode ? '保存中…' : '作品へ話を追加'
        }}
      </button>
      <p
        v-if="existingSeriesEpisodeSubmission"
        class="registration-message"
        :class="`registration-message--${existingSeriesEpisodeSubmission.status}`"
        role="status"
      >
        {{ existingSeriesEpisodeSubmission.message }}
      </p>
    </form>

    <p v-if="saveFlowError" class="registration-message registration-message--error" role="alert">
      {{ saveFlowError }}
    </p>
  </main>
</template>

<style scoped>
.save-view {
  display: grid;
  gap: 1rem;
}

h1,
p {
  margin: 0;
}

h1 {
  font-size: 1.5rem;
}

h2 {
  margin: 0;
  font-size: 1.125rem;
}

.save-view__description {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.registration-mode {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.registration-mode__button {
  min-height: 3rem;
  padding: 0.5rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.5rem;
}

.registration-mode__button--selected {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 10%);
  border-color: rgb(var(--v-theme-primary));
}

.registration-mode__button:focus-visible {
  outline: 0.1875rem solid rgb(var(--v-theme-primary));
  outline-offset: 0.125rem;
}

.registration-fields {
  display: grid;
  gap: 0.25rem;
}

.page-url-form {
  display: grid;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.5rem;
}

.registration-fields__label {
  display: grid;
  gap: 0.375rem;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.875rem;
  font-weight: 600;
}

.registration-fields__label input,
.registration-fields__label select {
  min-height: 3rem;
  padding: 0 0.75rem;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.25rem;
}

.page-url-form input {
  min-height: 3rem;
  padding: 0 0.75rem;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.25rem;
}

.page-url-form input[aria-invalid='true'] {
  border-color: #b91c1c;
}

.registration-fields__label input:focus-visible,
.registration-fields__label select:focus-visible {
  border-color: rgb(var(--v-theme-primary));
  outline: 0.125rem solid rgb(var(--v-theme-primary));
  outline-offset: -0.125rem;
}

.registration-submit {
  min-height: 3rem;
  color: rgb(var(--v-theme-on-primary));
  font: inherit;
  font-weight: 700;
  background: rgb(var(--v-theme-primary));
  border: 0;
  border-radius: 0.5rem;
}

.registration-submit:disabled {
  opacity: 0.6;
}

.registration-message {
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.registration-message--success {
  color: rgb(var(--v-theme-on-primary));
  background: rgb(var(--v-theme-primary));
}

.registration-message--error {
  color: #7f1d1d;
  background: #fee2e2;
}

.validated-url {
  overflow-wrap: anywhere;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.8125rem;
}

.image-candidates {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.5rem;
}

.image-candidates__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.image-candidates__selection-actions {
  display: flex;
  gap: 0.5rem;
}

.image-candidates__selection-actions button {
  min-height: 2.5rem;
  padding: 0 0.75rem;
  color: rgb(var(--v-theme-primary));
  font: inherit;
  font-weight: 700;
  background: transparent;
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 0.375rem;
}

.image-candidates__selection-actions button:disabled {
  opacity: 0.45;
}

.image-candidates__empty {
  padding: 1rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  text-align: center;
  background: rgba(var(--v-theme-on-surface), 5%);
  border-radius: 0.5rem;
}

.image-candidate-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.75rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.image-candidate {
  display: grid;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.5rem;
  background: rgb(var(--v-theme-surface));
  border: 0.125rem solid transparent;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 1px rgba(var(--v-border-color), var(--v-border-opacity));
}

.image-candidate--failed {
  border-color: #b91c1c;
}

.image-candidate__preview {
  width: 100%;
  height: 12rem;
  object-fit: contain;
  background: rgba(var(--v-theme-on-surface), 5%);
  border-radius: 0.25rem;
}

.image-candidate__preview--failed {
  display: grid;
  place-items: center;
  color: #7f1d1d;
  font-weight: 700;
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
