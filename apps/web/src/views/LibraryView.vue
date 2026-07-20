<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { mdiBookshelf, mdiMagnify, mdiPlus } from '@mdi/js'
import { database } from '@/database/database'
import { createMangaRepository, type TopLevelLibraryEntry } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import { getStandaloneEpisodeReaderRoute } from '@/router/readerRoute'
import AppIcon from '@/components/AppIcon.vue'
import AppKindBadge from '@/components/AppKindBadge.vue'
import AppThumbnail from '@/components/AppThumbnail.vue'
import { loadLibrarySortOrder, saveLibrarySortOrder } from '@/database/librarySettingsService'
import { createLibraryListItemPresenter, type LibraryListItem } from './libraryListItemPresenter'
import { getLibraryListState } from './libraryListState'
import { filterLibraryEntries } from './librarySearch'
import {
  DEFAULT_LIBRARY_SORT_ORDER,
  LIBRARY_SORT_ORDER_LABELS,
  LIBRARY_SORT_ORDERS,
  sortLibraryEntries,
  type LibrarySortOrder,
} from './librarySort'

const repository = createMangaRepository(database)
const itemPresenter = createLibraryListItemPresenter(createObjectUrlRegistry())
const entries = ref<TopLevelLibraryEntry[]>()
const libraryState = computed(() => getLibraryListState(entries.value))
const libraryItems = ref<LibraryListItem[]>([])
const sortOrder = ref<LibrarySortOrder>(DEFAULT_LIBRARY_SORT_ORDER)
const searchQuery = ref('')
const searchIndex = ref<ReadonlyMap<string, string>>(new Map())
const isSearching = computed(() => searchQuery.value.trim() !== '')
const hasNoSearchResults = computed(
  () =>
    libraryState.value.kind === 'populated' && isSearching.value && libraryItems.value.length === 0,
)

function renderItems() {
  const sorted = sortLibraryEntries(entries.value ?? [], sortOrder.value)
  const filtered = filterLibraryEntries(sorted, searchQuery.value, searchIndex.value)
  libraryItems.value = itemPresenter.present(filtered)
}

async function loadLibrary() {
  const [savedEntries, savedSortOrder, savedSearchIndex] = await Promise.all([
    repository.topLevelLibrary.findAll(),
    loadLibrarySortOrder(repository),
    repository.librarySearch.buildIndex(),
  ])

  entries.value = savedEntries
  sortOrder.value = savedSortOrder
  searchIndex.value = savedSearchIndex
  renderItems()
}

function onSearchInput(event: Event) {
  searchQuery.value = (event.target as HTMLInputElement).value
  renderItems()
}

function clearSearch() {
  searchQuery.value = ''
  renderItems()
}

async function changeSortOrder(order: LibrarySortOrder) {
  if (order === sortOrder.value) return

  sortOrder.value = order
  renderItems()
  await saveLibrarySortOrder(repository, order)
}

function onSortOrderChange(event: Event) {
  void changeSortOrder((event.target as HTMLSelectElement).value as LibrarySortOrder)
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
      <!-- 並べ替えは項目がある通常表示のときだけ操作可能にする -->
      <label v-if="libraryState.kind === 'populated'" class="library-sort">
        <span class="visually-hidden">並び順</span>
        <select
          class="app-field library-sort__select"
          :value="sortOrder"
          @change="onSortOrderChange"
        >
          <option v-for="order in LIBRARY_SORT_ORDERS" :key="order" :value="order">
            {{ LIBRARY_SORT_ORDER_LABELS[order] }}
          </option>
        </select>
      </label>
    </header>

    <!-- 検索：データがある通常表示のときだけ操作可能にする -->
    <div v-if="libraryState.kind === 'populated'" class="library-search">
      <AppIcon :path="mdiMagnify" :size="20" class="library-search__icon" aria-hidden="true" />
      <input
        type="search"
        class="app-field library-search__input"
        :value="searchQuery"
        placeholder="タイトル・URLで検索"
        aria-label="本棚を検索"
        @input="onSearchInput"
      />
    </div>

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

    <!-- 検索結果なし -->
    <div v-else-if="hasNoSearchResults" class="library-empty">
      <div class="library-empty__icon" aria-hidden="true">
        <AppIcon :path="mdiMagnify" :size="40" />
      </div>
      <h2 class="app-heading library-empty__title">見つかりませんでした</h2>
      <p class="library-empty__message">
        「{{ searchQuery.trim() }}」に一致する作品や話はありません。
      </p>
      <button type="button" class="app-btn app-btn--secondary" @click="clearSearch">
        検索を解除
      </button>
    </div>

    <!-- 通常：作品・単独の話を同じグリッドに混在 -->
    <ul v-else class="library-grid">
      <li v-for="item in libraryItems" :key="item.itemId">
        <component
          :is="RouterLink"
          class="library-card library-card--link"
          :to="
            item.kind === 'series'
              ? { name: 'seriesDetail', params: { seriesId: item.itemId } }
              : getStandaloneEpisodeReaderRoute(item.itemId)
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
          <p
            v-if="item.readingProgress"
            class="library-card__progress"
            :class="{ 'library-card__progress--done': item.readingProgress.status === 'completed' }"
          >
            {{ item.readingProgress.label }}
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

.library-sort {
  margin-left: auto;
}

.library-search {
  position: relative;
  margin-bottom: var(--app-space-md);
}

.library-search__icon {
  position: absolute;
  top: 50%;
  left: var(--app-space-xs);
  color: var(--app-color-text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.library-search__input {
  width: 100%;
  padding-left: calc(var(--app-space-xs) * 2 + 1.25rem);
}

.library-sort__select {
  min-height: 2.5rem;
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

.library-card__progress {
  margin: 0;
  color: var(--app-color-primary);
  font-size: var(--app-font-size-xs);
  font-weight: var(--app-font-weight-medium);
}

.library-card__progress--done {
  color: var(--app-color-text-muted);
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
