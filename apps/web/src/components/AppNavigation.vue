<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { mdiBookshelf, mdiCog, mdiCogOutline, mdiFilePlus, mdiFilePlusOutline } from '@mdi/js'
import AppIcon from './AppIcon.vue'

/**
 * 主要導線は「本棚」「保存」「設定」の3タブ。
 * 作品詳細・漫画閲覧は本棚配下、ストレージ管理は設定配下として、
 * 対応するタブを現在地表示する（各画面のルート名をタブへ束ねる）。
 */
type NavItem = {
  label: string
  routeName: string
  routeGroup: string[]
  icon: string
  iconActive: string
}

const navigationItems: NavItem[] = [
  {
    label: '本棚',
    routeName: 'library',
    routeGroup: ['library', 'seriesDetail', 'reader'],
    icon: mdiBookshelf,
    iconActive: mdiBookshelf,
  },
  {
    label: '保存',
    routeName: 'save',
    routeGroup: ['save'],
    icon: mdiFilePlusOutline,
    iconActive: mdiFilePlus,
  },
  {
    label: '設定',
    routeName: 'settings',
    routeGroup: ['settings', 'storage'],
    icon: mdiCogOutline,
    iconActive: mdiCog,
  },
]

const route = useRoute()

function isActive(item: NavItem): boolean {
  return item.routeGroup.includes(route.name as string)
}
</script>

<template>
  <nav aria-label="メインナビゲーション" class="app-navigation">
    <RouterLink
      v-for="item in navigationItems"
      :key="item.routeName"
      class="app-navigation__item"
      :class="{ 'app-navigation__item--active': isActive(item) }"
      :to="{ name: item.routeName }"
      :aria-current="isActive(item) ? 'page' : undefined"
    >
      <AppIcon
        class="app-navigation__icon"
        :path="isActive(item) ? item.iconActive : item.icon"
        :size="24"
      />
      <span class="app-navigation__label">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-navigation {
  position: fixed;
  z-index: 1000;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  width: min(100%, var(--app-content-max-width));
  margin: 0 auto;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--app-color-surface);
  border-top: 1px solid var(--app-color-border);
}

.app-navigation__item {
  display: grid;
  grid-auto-rows: min-content;
  justify-items: center;
  gap: var(--app-space-3xs);
  min-width: 0;
  padding: var(--app-space-2xs) var(--app-space-3xs) calc(var(--app-space-2xs) + 0.125rem);
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-xs);
  font-weight: var(--app-font-weight-medium);
  text-decoration: none;
}

.app-navigation__item--active {
  color: var(--app-color-text);
  font-weight: var(--app-font-weight-bold);
}

.app-navigation__icon {
  color: inherit;
}

.app-navigation__item:focus-visible {
  outline: 0.1875rem solid var(--app-color-primary);
  outline-offset: -0.25rem;
  border-radius: var(--app-radius-sm);
}
</style>
