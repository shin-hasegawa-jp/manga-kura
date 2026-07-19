<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { database } from '@/database/database'
import { createMangaRepository, type TopLevelLibraryEntry } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
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
  <main>
    <h1>ライブラリ</h1>

    <p v-if="libraryState.kind === 'loading'" class="app-message app-message--info" role="status">
      読込中…
    </p>

    <p v-else-if="libraryState.kind === 'empty'" class="app-message app-message--info">
      保存済みの作品や話はありません。
    </p>

    <ul v-else class="library-list">
      <li v-for="item in libraryItems" :key="item.itemId">
        <component
          :is="item.kind === 'series' ? RouterLink : 'div'"
          class="library-item"
          :to="
            item.kind === 'series'
              ? { name: 'seriesDetail', params: { seriesId: item.itemId } }
              : undefined
          "
        >
          <div class="library-item__thumb">
            <AppThumbnail :src="item.thumbnailUrl" :label="item.title" />
          </div>
          <div>
            <AppKindBadge :kind="item.kind === 'series' ? 'series' : 'standalone'" />
            <h2>{{ item.title }}</h2>
            <p v-if="item.detailLabel" class="library-item__detail">{{ item.detailLabel }}</p>
          </div>
        </component>
      </li>
    </ul>
  </main>
</template>

<style scoped>
h1,
h2,
p {
  margin: 0;
}

h1 {
  margin-bottom: var(--app-space-md);
  font-size: var(--app-font-size-xl);
}

.library-list {
  display: grid;
  gap: var(--app-space-xs);
  padding: 0;
  margin: 0;
  list-style: none;
}

.library-item {
  display: flex;
  gap: var(--app-space-sm);
  align-items: center;
  padding: var(--app-space-xs);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-md);
  color: inherit;
  text-decoration: none;
}

.library-item[href]:focus-visible {
  outline: 0.1875rem solid var(--app-color-primary);
  outline-offset: 0.125rem;
}

.library-item h2 {
  margin-top: var(--app-space-3xs);
  font-size: var(--app-font-size-md);
}

.library-item__detail {
  margin-top: var(--app-space-3xs);
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.library-item__thumb {
  flex: 0 0 auto;
  width: 3.5rem;
}
</style>
