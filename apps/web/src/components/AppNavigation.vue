<script setup lang="ts">
import { RouterLink } from 'vue-router'

const navigationItems = [
  { label: '本棚', routeName: 'library' },
  { label: '保存', routeName: 'save' },
  { label: '閲覧', routeName: 'reader' },
  { label: '容量', routeName: 'storage' },
  { label: '設定', routeName: 'settings' },
]
</script>

<template>
  <nav aria-label="メインナビゲーション" class="app-navigation">
    <RouterLink
      v-for="item in navigationItems"
      :key="item.routeName"
      class="app-navigation__item"
      :to="{ name: item.routeName }"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-navigation {
  position: fixed;
  z-index: 1000;
  bottom: 0;
  left: 50%;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  width: min(100%, 48rem);
  min-height: 4rem;
  padding-bottom: env(safe-area-inset-bottom);
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: 0;
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -0.25rem 1rem rgb(0 0 0 / 8%);
  transform: translateX(-50%);
}

.app-navigation__item {
  display: grid;
  place-items: center;
  min-width: 0;
  padding: 0.75rem 0.25rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: none;
}

.app-navigation__item[aria-current='page'] {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 10%);
  box-shadow: inset 0 0.1875rem rgb(var(--v-theme-primary));
}

.app-navigation__item:focus-visible {
  outline: 0.1875rem solid rgb(var(--v-theme-primary));
  outline-offset: -0.25rem;
}
</style>
