<script setup lang="ts">
import { computed, ref } from 'vue'
import { database } from '@/database/database'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { createComicRegistrationService } from '@/database/registrationService'
import {
  getRegistrationFields,
  registrationModeOptions,
  type RegistrationMode,
} from './saveRegistrationMode'
import {
  submitNewSeriesRegistration,
  type NewSeriesRegistrationSubmission,
} from './saveNewSeriesRegistration'

const registrationMode = ref<RegistrationMode>('newSeries')
const registrationFields = computed(() => getRegistrationFields(registrationMode.value))
const registrationService = createComicRegistrationService(database)
const newSeriesTitle = ref('')
const newSeriesEpisodeTitle = ref('')
const newSeriesSourcePageUrl = ref('')
const newSeriesSubmission = ref<NewSeriesRegistrationSubmission>()
const isSubmittingNewSeries = ref(false)

function selectRegistrationMode(mode: RegistrationMode) {
  registrationMode.value = mode
  newSeriesSubmission.value = undefined
}

function createFixedImageForRegistration() {
  const image = createDevelopmentComicFixture().image

  return { ...image, id: crypto.randomUUID() }
}

async function registerNewSeries() {
  isSubmittingNewSeries.value = true

  try {
    newSeriesSubmission.value = await submitNewSeriesRegistration(
      registrationService,
      {
        seriesTitle: newSeriesTitle.value,
        title: newSeriesEpisodeTitle.value,
        sourcePageUrl: newSeriesSourcePageUrl.value,
      },
      createFixedImageForRegistration(),
    )
  } finally {
    isSubmittingNewSeries.value = false
  }
}
</script>

<template>
  <main class="save-view">
    <h1>URL入力・保存</h1>

    <p class="save-view__description">保存する話の登録方法を選択してください。</p>

    <div class="registration-mode" aria-label="登録方法">
      <button
        v-for="option in registrationModeOptions"
        :key="option.value"
        class="registration-mode__button"
        :class="{ 'registration-mode__button--selected': registrationMode === option.value }"
        type="button"
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
      @submit.prevent="registerNewSeries"
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
      <button class="registration-submit" :disabled="isSubmittingNewSeries" type="submit">
        {{ isSubmittingNewSeries ? '登録中…' : '新規作品を登録' }}
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

    <section v-else class="registration-fields" :aria-label="`${registrationMode}の入力項目`">
      <label
        v-for="field in registrationFields"
        :key="field.name"
        class="registration-fields__label"
      >
        <span>{{ field.label }}</span>
        <input :name="field.name" :type="field.inputType" />
      </label>
    </section>
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

.registration-fields__label {
  display: grid;
  gap: 0.375rem;
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
  font-size: 0.875rem;
  font-weight: 600;
}

.registration-fields__label input {
  min-height: 3rem;
  padding: 0 0.75rem;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 0.25rem;
}

.registration-fields__label input:focus-visible {
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
</style>
