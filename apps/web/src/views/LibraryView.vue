<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { mdiBookshelf, mdiPlus } from '@mdi/js'
import { database } from '@/database/database'
import { createMangaRepository, type TopLevelLibraryEntry } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import AppIcon from '@/components/AppIcon.vue'
import AppKindBadge from '@/components/AppKindBadge.vue'
import AppThumbnail from '@/components/AppThumbnail.vue'
import { createLibraryListItemPresenter, type LibraryListItem } from './libraryListItemPresenter'
import { getLibraryListState } from './libraryListState'

const repository = createMangaRepository(database)
const itemPresenter = createLibraryListItemPresenter(createObjectUrlRegistry())
const entries = ref<TopLevelLibraryEntry[]>()
const libraryState = computed(() => getLibraryListState(entries.value))
const libraryItems = ref<LibraryListItem[]>([])

async function loadLibrary() {
  const savedEntries = await repository.topLevelLibrary.findAll()

  entries.value = savedEntries
  libraryItems.value = itemPresenter.present(savedEntries)
}

onMounted(loadLibrary)
onBeforeUnmount(() => itemPresenter.dispose())
</script>

<template>
  <main class="library">
    <header class="library-header">
      <h1 class="app-display">本棚</h1>
      <p v-if="libraryState.kind === 'populated'" class="library-header__count">
        全{{ libraryItems.length }}件
      </p>
    </header>

    <!-- 読み込み中：本棚のスケルトン -->
    <template v-if="libraryState.kind === 'loading'">
      <p class="visually-hidden" role="status">本棚を読み込んでいます</p>
      <ul class="library-grid" aria-hidden="true">
        <li v-for="n in 4" :key="n" class="library-card library-card--skeleton">
          <div class="library-card__thumb app-skeleton"></div>
          <div class="app-skeleton app-skeleton--line"></div>
          <div class="app-skeleton app-skeleton--line app-skeleton--line-short"></div>
        </li>
      </ul>
    </template>

    <!-- 空状態：保存への導線 -->
    <div v-else-if="libraryState.kind === 'empty'" class="library-empty">
      <div class="library-empty__icon" aria-hidden="true">
        <AppIcon :path="mdiBookshelf" :size="40" />
      </div>
      <h2 class="app-heading library-empty__title">蔵はまだ空っぽ</h2>
      <p class="library-empty__message">
        気に入ったWeb漫画のページを保存すると、ここに並んでいくよ。まずは1話しまってみよう。
      </p>
      <RouterLink class="app-btn app-btn--primary" :to="{ name: 'save' }">
        <AppIcon :path="mdiPlus" :size="20" />
        漫画を保存する
      </RouterLink>
    </div>

    <!-- 通常：作品・単独の話を同じグリッドに混在 -->
    <ul v-else class="library-grid">
      <li v-for="item in libraryItems" :key="item.itemId">
        <component
          :is="item.kind === 'series' ? RouterLink : 'div'"
          class="library-card"
          :class="{ 'library-card--link': item.kind === 'series' }"
          :to="
            item.kind === 'series'
              ? { name: 'seriesDetail', params: { seriesId: item.itemId } }
              : undefined
          "
        >
          <div class="library-card__thumb">
            <AppThumbnail :src="item.thumbnailUrl" :label="item.title" ratio="3 / 4" />
            <span class="library-card__kind">
              <AppKindBadge :kind="item.kind === 'series' ? 'series' : 'standalone'" />
            </span>
            <span v-if="item.kind === 'series' && item.detailLabel" class="library-card__count">
              {{ item.detailLabel }}
            </span>
          </div>
          <h2 class="library-card__title">{{ item.title }}</h2>
          <p
            v-if="item.kind === 'standaloneEpisode' && item.detailLabel"
            class="library-card__detail"
          >
            {{ item.detailLabel }}
          </p>
        </component>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.library-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--app-space-2xs) var(--app-space-sm);
  margin-bottom: var(--app-space-md);
}

.library-header__count {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.library-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--app-space-md) var(--app-space-sm);
  padding: 0;
  margin: 0;
  list-style: none;
}

.library-card {
  display: grid;
  gap: var(--app-space-2xs);
  color: inherit;
  text-decoration: none;
}

.library-card--link {
  cursor: pointer;
}

.library-card--link:focus-visible {
  outline: 0.1875rem solid var(--app-color-primary);
  outline-offset: 0.25rem;
  border-radius: var(--app-radius-md);
}

.library-card__thumb {
  position: relative;
}

.library-card__kind {
  position: absolute;
  top: var(--app-space-2xs);
  left: var(--app-space-2xs);
}

.library-card__count {
  position: absolute;
  right: var(--app-space-2xs);
  bottom: var(--app-space-2xs);
  padding: 0.125rem var(--app-space-2xs);
  color: var(--app-color-text);
  font-size: var(--app-font-size-xs);
  font-weight: var(--app-font-weight-bold);
  background: var(--app-color-surface);
  border-radius: var(--app-radius-sm);
}

.library-card__title {
  margin: 0;
  font-size: var(--app-font-size-md);
  font-weight: var(--app-font-weight-bold);
  line-height: var(--app-line-height-tight);
}

.library-card__detail {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

/* ---- 空状態 ---- */
.library-empty {
  display: grid;
  justify-items: center;
  gap: var(--app-space-sm);
  padding: var(--app-space-xl) var(--app-space-sm);
  text-align: center;
}

.library-empty__icon {
  display: grid;
  place-items: center;
  width: 5rem;
  height: 5rem;
  color: var(--app-color-text-muted);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-xl);
}

.library-empty__title {
  margin: 0;
  font-size: var(--app-font-size-xl);
}

.library-empty__message {
  max-width: 20rem;
  margin: 0;
  color: var(--app-color-text-muted);
}

/* ---- 読み込みスケルトン ---- */
.library-card--skeleton {
  pointer-events: none;
}

.app-skeleton {
  background: var(--app-color-panel);
  border-radius: var(--app-radius-md);
  animation: app-skeleton-pulse 1.4s ease-in-out infinite;
}

.library-card--skeleton .library-card__thumb {
  aspect-ratio: 3 / 4;
}

.app-skeleton--line {
  height: 0.875rem;
  border-radius: var(--app-radius-sm);
}

.app-skeleton--line-short {
  width: 60%;
}

@keyframes app-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-skeleton {
    animation: none;
  }
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
