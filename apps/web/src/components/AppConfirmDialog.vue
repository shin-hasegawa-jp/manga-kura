<script setup lang="ts">
import { mdiAlertOutline } from '@mdi/js'
import AppIcon from './AppIcon.vue'

defineProps<{
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <div
    class="confirm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
  >
    <div class="confirm-dialog__panel">
      <div class="confirm-dialog__icon" aria-hidden="true">
        <AppIcon :path="mdiAlertOutline" :size="32" />
      </div>
      <h2 id="confirm-dialog-title" class="app-heading confirm-dialog__title">{{ title }}</h2>
      <p class="confirm-dialog__message">{{ message }}</p>
      <div class="confirm-dialog__actions">
        <button
          class="app-btn app-btn--secondary app-btn--block"
          type="button"
          :disabled="busy"
          @click="emit('cancel')"
        >
          {{ cancelLabel ?? 'キャンセル' }}
        </button>
        <button
          class="app-btn app-btn--danger app-btn--block"
          type="button"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.confirm-dialog {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: var(--app-space-md);
  background: rgba(0, 0, 0, 45%);
}

.confirm-dialog__panel {
  display: grid;
  justify-items: center;
  gap: var(--app-space-xs);
  width: 100%;
  max-width: 24rem;
  padding: var(--app-space-lg) var(--app-space-md);
  text-align: center;
  background: var(--app-color-surface);
  border-radius: var(--app-radius-lg);
}

.confirm-dialog__icon {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  color: var(--app-color-error);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-pill);
}

.confirm-dialog__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

.confirm-dialog__message {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.confirm-dialog__actions {
  display: grid;
  gap: var(--app-space-2xs);
  width: 100%;
  margin-top: var(--app-space-2xs);
}
</style>
