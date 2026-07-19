<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { database } from '@/database/database'
import { createMangaRepository, type SeriesDetails } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import AppKindBadge from '@/components/AppKindBadge.vue'
import AppThumbnail from '@/components/AppThumbnail.vue'
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

    <p v-if="detailState.kind === 'loading'" class="app-message app-message--info" role="status">
      読込中…
    </p>

    <p
      v-else-if="detailState.kind === 'notFound'"
      class="app-message app-message--error"
      role="alert"
    >
      指定された作品が見つかりません。
    </p>

    <template v-else-if="details">
      <header class="series-header">
        <AppKindBadge kind="series" />
        <h1>{{ details.series.title }}</h1>
        <p class="series-header__count">全{{ details.episodes.length }}話</p>
      </header>

      <p v-if="detailState.kind === 'empty'" class="app-message app-message--info">
        この作品には話が登録されていません。
      </p>

      <ul v-else class="episode-list">
        <li v-for="item in episodeItems" :key="item.episodeId" class="episode-item">
          <div class="episode-item__thumb">
            <AppThumbnail :src="item.thumbnailUrl" :label="item.title" />
          </div>
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
  gap: var(--app-space-2xs);
  align-items: center;
  margin-bottom: var(--app-space-xs);
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.breadcrumb a,
.back-link {
  color: var(--app-color-primary);
}

.back-link {
  display: inline-block;
  margin-bottom: var(--app-space-md);
}

.series-header {
  margin-bottom: var(--app-space-md);
}

.series-header h1 {
  margin: 0.25rem 0;
}

.series-header__count,
.episode-number {
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.episode-list {
  display: grid;
  gap: var(--app-space-xs);
  padding: 0;
  margin: 0;
  list-style: none;
}

.episode-item {
  display: flex;
  gap: var(--app-space-sm);
  align-items: center;
  padding: var(--app-space-xs);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-md);
}

.episode-item h2 {
  margin-top: var(--app-space-3xs);
  font-size: var(--app-font-size-md);
}

.episode-item__thumb {
  flex: 0 0 auto;
  width: 3.5rem;
}
</style>
