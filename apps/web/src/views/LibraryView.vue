<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { database } from '@/database/database'
import { createMangaRepository, type LibraryEntry } from '@/database/repository'
import { getLibraryEntryText } from './libraryEntryText'
import { getLibraryListState } from './libraryListState'

const repository = createMangaRepository(database)
const entries = ref<LibraryEntry[]>()
const libraryState = computed(() => getLibraryListState(entries.value))
const libraryItems = computed(() => entries.value?.map(getLibraryEntryText) ?? [])

async function loadLibrary() {
  entries.value = await repository.library.findAll()
}

onMounted(loadLibrary)
</script>

<template>
  <main>
    <h1>ライブラリ</h1>

    <p v-if="libraryState.kind === 'loading'" class="status-message">読込中…</p>

    <p v-else-if="libraryState.kind === 'empty'" class="status-message">
      保存済みの話はありません。
    </p>

    <ul v-else class="episode-list">
      <li v-for="item in libraryItems" :key="item.episodeId" class="episode-item">
        <p class="episode-item__context" :data-kind="item.kind">{{ item.contextLabel }}</p>
        <h2>{{ item.episodeTitle }}</h2>
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

.episode-list {
  display: grid;
  gap: 0.75rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

.episode-item {
  padding: 0.75rem;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 0.5rem;
}

.episode-item h2 {
  margin-top: 0.25rem;
  font-size: 1rem;
}

.episode-item__context {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}
</style>
