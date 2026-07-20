<script setup lang="ts">
import { mdiCheck } from '@mdi/js'
import AppIcon from './AppIcon.vue'

/**
 * 保存フローの4ステップ（URL入力→画像確認→情報入力→完了）の進行状況表示。
 * 完了済み・進行中・未到達を色だけでなく形（チェック／番号）でも区別する。
 */
const props = defineProps<{ current: number }>()

const steps = [
  { n: 1, label: 'URL' },
  { n: 2, label: '画像' },
  { n: 3, label: '情報' },
  { n: 4, label: '完了' },
]

function stateOf(n: number): 'done' | 'current' | 'upcoming' {
  if (n < props.current) return 'done'
  if (n === props.current) return 'current'
  return 'upcoming'
}
</script>

<template>
  <ol class="stepper" aria-label="保存の進行状況">
    <li
      v-for="step in steps"
      :key="step.n"
      class="stepper__item"
      :class="{ 'stepper__item--fill': step.n !== steps.length }"
      :data-state="stateOf(step.n)"
      :aria-current="stateOf(step.n) === 'current' ? 'step' : undefined"
    >
      <span class="stepper__marker">
        <AppIcon v-if="stateOf(step.n) === 'done'" :path="mdiCheck" :size="16" />
        <span v-else>{{ step.n }}</span>
      </span>
      <span v-if="stateOf(step.n) === 'current'" class="stepper__label">{{ step.label }}</span>
      <span v-if="step.n !== steps.length" class="stepper__line" aria-hidden="true"></span>
    </li>
  </ol>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  padding: 0;
  margin: 0;
  list-style: none;
}

.stepper__item {
  display: flex;
  align-items: center;
  gap: var(--app-space-2xs);
}

.stepper__item--fill {
  flex: 1;
}

.stepper__marker {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 1.75rem;
  height: 1.75rem;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
  font-weight: var(--app-font-weight-bold);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-pill);
}

.stepper__item[data-state='current'] .stepper__marker {
  color: var(--app-color-on-primary);
  background: var(--app-color-primary);
}

.stepper__item[data-state='done'] .stepper__marker {
  color: var(--app-color-on-cta);
  background: var(--app-color-cta);
}

.stepper__label {
  font-size: var(--app-font-size-sm);
  font-weight: var(--app-font-weight-bold);
}

.stepper__line {
  flex: 1;
  height: 0.125rem;
  margin: 0 var(--app-space-2xs);
  background: var(--app-color-border);
  border-radius: var(--app-radius-pill);
}

.stepper__item[data-state='done'] .stepper__line {
  background: var(--app-color-primary);
}
</style>
