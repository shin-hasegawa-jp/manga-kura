<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <!-- 未実装機能を含めない、設定関連画面への最小限の入口 -->
  <main class="settings">
    <h1 class="app-display">設定</h1>
    <RouterLink class="settings__storage-link" :to="{ name: 'storage' }">
      ストレージ管理
    </RouterLink>
  </main>
</template>

<style scoped>
.settings {
  display: grid;
  gap: var(--app-space-md);
}

.settings__storage-link {
  width: fit-content;
  color: var(--app-color-text);
  font-weight: 700;
  text-underline-offset: 0.25rem;
}

.settings__storage-link:focus-visible {
  border-radius: var(--app-radius-sm);
  outline: 3px solid var(--app-color-focus);
  outline-offset: 0.25rem;
}
</style>
