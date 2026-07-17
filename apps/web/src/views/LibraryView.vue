<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Episode } from '@/domain/models'
import { database } from '@/database/database'
import { createDevelopmentComicFixture } from '@/database/developmentComicFixture'
import { createMangaRepository } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'

interface LibraryEpisode {
  episode: Episode
  thumbnailUrl?: string
}

const repository = createMangaRepository(database)
const objectUrls = createObjectUrlRegistry()
const episodes = ref<LibraryEpisode[]>([])
const isRegistering = ref(false)

async function loadLibrary() {
  objectUrls.revokeAll()
  const savedEpisodes = await repository.episodes.findAll()

  episodes.value = await Promise.all(
    savedEpisodes.map(async (episode) => {
      const images = await repository.images.findByEpisodeId(episode.id)
      const firstImage = images[0]

      return {
        episode,
        thumbnailUrl: firstImage ? objectUrls.create(firstImage.blob) : undefined,
      }
    }),
  )
}

async function registerDevelopmentData() {
  isRegistering.value = true

  try {
    const fixture = createDevelopmentComicFixture()
    await repository.series.save(fixture.series)
    await repository.episodes.save(fixture.episode)
    await repository.images.save(fixture.image)
    await loadLibrary()
  } finally {
    isRegistering.value = false
  }
}

onMounted(loadLibrary)
onBeforeUnmount(() => objectUrls.revokeAll())
</script>

<template>
  <main>
    <div class="library-header">
      <h1>ライブラリ</h1>
      <button
        class="register-button"
        type="button"
        :disabled="isRegistering"
        @click="registerDevelopmentData"
      >
        {{ isRegistering ? '登録中…' : '開発用データを登録' }}
      </button>
    </div>

    <p v-if="episodes.length === 0" class="empty-message">
      保存済みの話はありません。開発用データを登録して表示を確認できます。
    </p>

    <ul v-else class="episode-list">
      <li v-for="item in episodes" :key="item.episode.id" class="episode-item">
        <img
          v-if="item.thumbnailUrl"
          class="thumbnail"
          :src="item.thumbnailUrl"
          :alt="`${item.episode.title}の先頭画像`"
        />
        <div v-else class="thumbnail thumbnail-placeholder" aria-hidden="true">画像なし</div>
        <div>
          <h2>{{ item.episode.title }}</h2>
          <p>{{ item.episode.seriesId ? '作品に登録済み' : '単独の話' }}</p>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 1.5rem;
}

.register-button {
  padding: 0.6rem 0.8rem;
  color: white;
  font: inherit;
  font-weight: 700;
  background: rgb(var(--v-theme-primary));
  border: 0;
  border-radius: 0.5rem;
}

.register-button:disabled {
  opacity: 0.6;
}

.empty-message {
  padding: 1rem;
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
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid rgb(var(--v-theme-outline-variant));
  border-radius: 0.5rem;
}

.episode-item h2 {
  font-size: 1rem;
}

.episode-item p {
  margin-top: 0.25rem;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}

.thumbnail {
  display: block;
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
