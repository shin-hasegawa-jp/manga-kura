<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { database } from '@/database/database'
import { createMangaRepository, type TopLevelLibraryEntry } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
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

    <p v-if="libraryState.kind === 'loading'" class="status-message">読込中…</p>

    <p v-else-if="libraryState.kind === 'empty'" class="status-message">
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
          <img
            v-if="item.thumbnailUrl"
            class="thumbnail"
            :src="item.thumbnailUrl"
            :alt="`${item.title}のサムネイル`"
          />
          <div v-else class="thumbnail thumbnail-placeholder" aria-hidden="true">画像なし</div>
          <div>
            <p class="library-item__kind" :data-kind="item.kind">{{ item.kindLabel }}</p>
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
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.status-message {
  padding: 1rem;
  margin: 0;
  color: rgb(var(--v-theme-on-surface));
  background: rgb(var(--v-theme-surface-variant));
  border-radius: 0.5rem;
}

.library-list {
  display: grid;
  gap: 0.75rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.library-item {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 0.5rem;
  color: inherit;
  text-decoration: none;
}

.library-item[href]:focus-visible {
  outline: 0.1875rem solid rgb(var(--v-theme-primary));
  outline-offset: 0.125rem;
}

.library-item h2 {
  margin-top: 0.25rem;
  font-size: 1rem;
}

.library-item__kind,
.library-item__detail {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}

.library-item__detail {
  margin-top: 0.25rem;
}

.thumbnail {
  display: block;
  flex: 0 0 auto;
  width: 3.5rem;
  height: 3.5rem;
  object-fit: cover;
  border-radius: 0.4rem;
}

.thumbnail-placeholder {
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
  background: rgb(var(--v-theme-surface-variant));
}
</style>
