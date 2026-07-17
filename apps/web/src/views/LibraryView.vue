<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { database } from '@/database/database'
import { createMangaRepository, type LibraryEntry } from '@/database/repository'
import { getLibraryListState } from './libraryListState'

const repository = createMangaRepository(database)
const entries = ref<LibraryEntry[]>()
const libraryState = computed(() => getLibraryListState(entries.value))

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
      <li v-for="item in libraryState.entries" :key="item.episode.id" class="episode-item">
        <h2>{{ item.episode.title }}</h2>
      </li>
    </ul>
  </main>
</template>

<style scoped>
h1,
h2 {
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
  font-size: 1rem;
}
</style>
