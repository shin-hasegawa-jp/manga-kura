<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { mdiAlertCircleOutline, mdiChevronLeft, mdiTextBoxOutline } from '@mdi/js'
import { database } from '@/database/database'
import { createMangaRepository, type SeriesDetails } from '@/database/repository'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import AppIcon from '@/components/AppIcon.vue'
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
// 作品サムネイルは本棚と同じく先頭話のサムネイルを流用する
const seriesThumbnailUrl = computed(() => episodeItems.value[0]?.thumbnailUrl)

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
  <main class="series-detail">
    <RouterLink
      class="app-icon-btn series-detail__back"
      :to="{ name: 'library' }"
      aria-label="本棚へ戻る"
    >
      <AppIcon :path="mdiChevronLeft" :size="28" />
    </RouterLink>

    <p v-if="detailState.kind === 'loading'" class="app-message app-message--info" role="status">
      読込中…
    </p>

    <!-- Not Found：空状態と区別した表示 -->
    <div v-else-if="detailState.kind === 'notFound'" class="series-state" role="alert">
      <div class="series-state__icon" aria-hidden="true">
        <AppIcon :path="mdiAlertCircleOutline" :size="40" />
      </div>
      <h1 class="app-heading series-state__title">作品が見つかりません</h1>
      <p class="series-state__message">
        指定された作品は削除されたか、URLが正しくない可能性があります。
      </p>
      <RouterLink class="app-btn app-btn--secondary" :to="{ name: 'library' }">
        本棚へ戻る
      </RouterLink>
    </div>

    <template v-else-if="details">
      <header class="series-header">
        <div class="series-header__thumb">
          <AppThumbnail :src="seriesThumbnailUrl" :label="details.series.title" ratio="3 / 4" />
        </div>
        <div class="series-header__meta">
          <h1 class="app-heading series-header__title">{{ details.series.title }}</h1>
          <p class="series-header__count">全{{ details.episodes.length }}話</p>
        </div>
      </header>

      <h2 class="series-detail__section-title">話一覧</h2>

      <!-- 話なし：空状態 -->
      <div v-if="detailState.kind === 'empty'" class="series-state series-state--inline">
        <div class="series-state__icon" aria-hidden="true">
          <AppIcon :path="mdiTextBoxOutline" :size="40" />
        </div>
        <p class="series-state__title app-heading">まだ話がありません</p>
        <p class="series-state__message">この作品に最初の話を追加しよう。</p>
      </div>

      <ul v-else class="episode-list">
        <li v-for="item in episodeItems" :key="item.episodeId">
          <RouterLink
            class="episode-item"
            :to="{ name: 'reader', params: { episodeId: item.episodeId } }"
          >
            <div class="episode-item__thumb">
              <AppThumbnail :src="item.thumbnailUrl" :label="item.title" />
            </div>
            <h3 class="episode-item__title">
              <span v-if="item.episodeNumberLabel" class="episode-item__number">
                {{ item.episodeNumberLabel }}
              </span>
              {{ item.title }}
            </h3>
          </RouterLink>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.series-detail__back {
  margin-left: calc(var(--app-space-2xs) * -1);
  margin-bottom: var(--app-space-2xs);
}

/* ---- 作品ヘッダー ---- */
.series-header {
  display: flex;
  gap: var(--app-space-sm);
  margin-bottom: var(--app-space-md);
}

.series-header__thumb {
  flex: 0 0 auto;
  width: 7.5rem;
}

.series-header__meta {
  display: grid;
  align-content: start;
  gap: var(--app-space-3xs);
  padding-top: var(--app-space-2xs);
}

.series-header__title {
  margin: 0;
  font-size: var(--app-font-size-xl);
}

.series-header__count {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.series-detail__section-title {
  margin: 0 0 var(--app-space-xs);
  font-size: var(--app-font-size-lg);
}

/* ---- 話一覧 ---- */
.episode-list {
  display: grid;
  gap: 0;
  padding: 0;
  margin: 0;
  list-style: none;
}

.episode-item {
  display: flex;
  gap: var(--app-space-sm);
  align-items: center;
  padding: var(--app-space-xs) 0;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px solid var(--app-color-border);
}

.episode-item__thumb {
  flex: 0 0 auto;
  width: 3.5rem;
}

.episode-item__title {
  margin: 0;
  font-size: var(--app-font-size-md);
  font-weight: var(--app-font-weight-bold);
}

.episode-item__number {
  margin-right: var(--app-space-3xs);
}

/* ---- 空状態・Not Found ---- */
.series-state {
  display: grid;
  justify-items: center;
  gap: var(--app-space-2xs);
  padding: var(--app-space-xl) var(--app-space-sm);
  text-align: center;
}

.series-state--inline {
  padding-top: var(--app-space-lg);
}

.series-state__icon {
  display: grid;
  place-items: center;
  width: 5rem;
  height: 5rem;
  margin-bottom: var(--app-space-2xs);
  color: var(--app-color-text-muted);
  background: var(--app-color-panel);
  border-radius: var(--app-radius-xl);
}

.series-state__title {
  margin: 0;
  font-size: var(--app-font-size-lg);
}

.series-state__message {
  max-width: 20rem;
  margin: 0 0 var(--app-space-2xs);
  color: var(--app-color-text-muted);
}
</style>
