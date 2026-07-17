<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { database } from '@/database/database'
import { createMangaRepository, type SeriesDetails } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import { getSeriesDetailState } from './seriesDetailState'
import {
  createSeriesEpisodeListItemPresenter,
  type SeriesEpisodeListItem,
} from './seriesEpisodeListItemPresenter'

const route = useRoute()
const repository = createMangaRepository(database)
const itemPresenter = createSeriesEpisodeListItemPresenter(createObjectUrlRegistry())
const isLoading = ref(true)
const details = ref<SeriesDetails>()
const episodeItems = ref<SeriesEpisodeListItem[]>([])
const detailState = computed(() => getSeriesDetailState(isLoading.value, details.value))

function getRouteSeriesId(): string {
  const routeSeriesId = route.params.seriesId

  if (typeof routeSeriesId === 'string') {
    return routeSeriesId
  }

  return routeSeriesId?.[0] ?? ''
}

async function loadSeriesDetails() {
  isLoading.value = true
  const savedDetails = await repository.seriesDetails.findBySeriesId(getRouteSeriesId())

  details.value = savedDetails
  episodeItems.value = itemPresenter.present(savedDetails?.episodes ?? [])
  isLoading.value = false
}

onMounted(loadSeriesDetails)
onBeforeUnmount(() => itemPresenter.dispose())
</script>

<template>
  <main>
    <nav aria-label="パンくず" class="breadcrumb">
      <RouterLink :to="{ name: 'library' }">ライブラリ</RouterLink>
      <span aria-hidden="true">/</span>
      <span>{{ details?.series.title ?? '作品' }}</span>
    </nav>

    <RouterLink class="back-link" :to="{ name: 'library' }">← ライブラリへ戻る</RouterLink>

    <p v-if="detailState.kind === 'loading'" class="status-message">読込中…</p>

    <p v-else-if="detailState.kind === 'notFound'" class="status-message" role="alert">
      指定された作品が見つかりません。
    </p>

    <template v-else-if="details">
      <header class="series-header">
        <p class="series-kind">作品</p>
        <h1>{{ details.series.title }}</h1>
        <p>全{{ details.episodes.length }}話</p>
      </header>

      <p v-if="detailState.kind === 'empty'" class="status-message">
        この作品には話が登録されていません。
      </p>

      <ul v-else class="episode-list">
        <li v-for="item in episodeItems" :key="item.episodeId" class="episode-item">
          <img
            v-if="item.thumbnailUrl"
            class="thumbnail"
            :src="item.thumbnailUrl"
            :alt="`${item.title}のサムネイル`"
          />
          <div v-else class="thumbnail thumbnail-placeholder" aria-hidden="true">画像なし</div>
          <div>
            <p v-if="item.episodeNumberLabel" class="episode-number">
              {{ item.episodeNumberLabel }}
            </p>
            <h2>{{ item.title }}</h2>
          </div>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 1.5rem;
}

.breadcrumb {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}

.breadcrumb a,
.back-link {
  color: rgb(var(--v-theme-primary));
}

.back-link {
  display: inline-block;
  margin-bottom: 1.5rem;
}

.series-header {
  margin-bottom: 1.5rem;
}

.series-header h1 {
  margin: 0.25rem 0;
}

.series-kind,
.series-header p,
.episode-number {
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.875rem;
}

.status-message {
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
  margin-top: 0.25rem;
  font-size: 1rem;
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
