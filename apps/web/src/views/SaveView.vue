<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getRegistrationFields,
  registrationModeOptions,
  type RegistrationMode,
} from './saveRegistrationMode'

const registrationMode = ref<RegistrationMode>('newSeries')
const registrationFields = computed(() => getRegistrationFields(registrationMode.value))
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
        @click="registrationMode = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <section class="registration-fields" :aria-label="`${registrationMode}の入力項目`">
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
</style>
