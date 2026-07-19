<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { mdiAlertOutline, mdiCheck, mdiChevronLeft, mdiImageOffOutline, mdiReload } from '@mdi/js'
import { database } from '@/database/database'
import { createMangaRepository } from '@/database/repository'
import type { ComicImage, Episode, Series } from '@/domain/models'
import { createObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import { getReaderRouteTarget, isReaderRouteTargetValid } from '@/router/readerRoute'
import AppIcon from '@/components/AppIcon.vue'
import { createReaderImagePresenter, type ReaderImageItem } from './readerImagePresenter'
import { getReaderBackRoute, getReaderViewState } from './readerViewState'

const route = useRoute()
const repository = createMangaRepository(database)
const imagePresenter = createReaderImagePresenter(createObjectUrlRegistry())
const isLoading = ref(true)
const episode = ref<Episode>()
const series = ref<Series>()
const images = ref<ComicImage[]>([])
const imageItems = ref<ReaderImageItem[]>([])
const failedImageIds = ref<ReadonlySet<string>>(new Set())
const currentImage = ref(1)
const hasReachedEnd = ref(false)
const readerState = computed(() =>
  getReaderViewState(isLoading.value, episode.value, series.value, images.value),
)
const backRoute = computed(() =>
  episode.value ? getReaderBackRoute(episode.value) : { name: 'library' },
)
const contextLabel = computed(() => series.value?.title ?? '単独の話')
const progress = computed(() =>
  imageItems.value.length === 0
    ? 0
    : Math.round((currentImage.value / imageItems.value.length) * 100),
)

async function loadReader() {
  isLoading.value = true
  imagePresenter.dispose()
  failedImageIds.value = new Set()
  currentImage.value = 1
  hasReachedEnd.value = false

  const routeTarget = getReaderRouteTarget(
    route.name,
    route.params.seriesId,
    route.params.episodeId,
  )
  const candidateEpisode = routeTarget
    ? await repository.episodes.findById(routeTarget.episodeId)
    : undefined
  const savedEpisode =
    routeTarget && candidateEpisode && isReaderRouteTargetValid(routeTarget, candidateEpisode)
      ? candidateEpisode
      : undefined
  const [savedSeries, savedImages] = await Promise.all([
    savedEpisode?.seriesId ? repository.series.findById(savedEpisode.seriesId) : undefined,
    savedEpisode ? repository.images.findByEpisodeId(savedEpisode.id) : [],
  ])
  episode.value = savedEpisode
  series.value = savedSeries
  images.value = savedImages
  imageItems.value = imagePresenter.present(savedImages)
  isLoading.value = false
  await nextTick()
  updateReadingPosition()
  window.setTimeout(updateReadingPosition, 0)
}

function markImageFailed(imageId: string) {
  failedImageIds.value = new Set([...failedImageIds.value, imageId])
}

async function onImageLoaded() {
  await nextTick()
  updateReadingPosition()
}

function retryImage(imageId: string) {
  failedImageIds.value = new Set([...failedImageIds.value].filter((id) => id !== imageId))
  imageItems.value = imagePresenter.present(images.value)
}

function updateReadingPosition() {
  const elements = document.querySelectorAll<HTMLElement>('[data-reader-image]')
  let nearestIndex = 0
  let nearestDistance = Number.POSITIVE_INFINITY

  elements.forEach((element, index) => {
    const distance = Math.abs(element.getBoundingClientRect().top)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  currentImage.value = elements.length === 0 ? 1 : nearestIndex + 1
  hasReachedEnd.value =
    elements.length > 0 &&
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24
}

watch(() => route.fullPath, loadReader)
onMounted(() => {
  void loadReader()
  window.addEventListener('scroll', updateReadingPosition, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateReadingPosition)
  imagePresenter.dispose()
})
</script>

<template>
  <main class="reader">
    <p v-if="readerState.kind === 'loading'" class="reader-state" role="status">
      漫画を読み込んでいます…
    </p>

    <section v-else-if="readerState.kind === 'notFound'" class="reader-state" role="alert">
      <AppIcon :path="mdiAlertOutline" :size="44" />
      <h1>話が見つかりません</h1>
      <p>指定された話は削除されたか、URLが正しくない可能性があります。</p>
      <RouterLink class="reader-btn" :to="{ name: 'library' }">本棚へ戻る</RouterLink>
    </section>

    <section v-else-if="readerState.kind === 'empty'" class="reader-state">
      <AppIcon :path="mdiImageOffOutline" :size="44" />
      <h1>画像がありません</h1>
      <p>この話には閲覧できる画像が保存されていません。</p>
      <RouterLink class="reader-btn" :to="backRoute">戻る</RouterLink>
    </section>

    <template v-else-if="readerState.kind === 'ready'">
      <header class="reader-header">
        <RouterLink class="reader-icon-btn" :to="backRoute" :aria-label="`${contextLabel}へ戻る`">
          <AppIcon :path="mdiChevronLeft" :size="28" />
        </RouterLink>
        <div class="reader-header__title">
          <h1>{{ readerState.episode.title }}</h1>
          <p>{{ contextLabel }}</p>
        </div>
      </header>

      <ol class="reader-stream">
        <li
          v-for="(item, index) in imageItems"
          :key="item.id"
          class="reader-page"
          data-reader-image
        >
          <img
            v-if="!failedImageIds.has(item.id)"
            :src="item.url"
            :alt="`${readerState.episode.title} ${index + 1}ページ目`"
            :width="item.width"
            :height="item.height"
            @load="onImageLoaded"
            @error="markImageFailed(item.id)"
          />
          <div v-else class="reader-page__failure" role="alert">
            <AppIcon :path="mdiImageOffOutline" :size="40" />
            <p>この画像は表示できません</p>
            <button type="button" @click="retryImage(item.id)">
              <AppIcon :path="mdiReload" :size="18" />
              再読み込み
            </button>
          </div>
        </li>
      </ol>

      <aside class="reader-progress" aria-live="polite">
        <span>{{ currentImage }} / {{ imageItems.length }}</span>
        <span class="reader-progress__track" aria-hidden="true">
          <span :style="{ width: `${progress}%` }"></span>
        </span>
        <span>{{ progress }}%</span>
      </aside>

      <section v-if="hasReachedEnd" class="reader-complete" aria-labelledby="reader-complete-title">
        <div class="reader-complete__check"><AppIcon :path="mdiCheck" :size="32" /></div>
        <h2 id="reader-complete-title">{{ readerState.episode.title }} 読了</h2>
        <p>最後まで読みました。</p>
        <RouterLink class="reader-btn" :to="backRoute">
          {{ readerState.episode.seriesId ? '作品詳細に戻る' : '本棚に戻る' }}
        </RouterLink>
      </section>
    </template>
  </main>
</template>

<style scoped>
.reader {
  min-height: 100dvh;
  color: #fff;
  background: #0e0d0c;
}
.reader-header {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--app-space-2xs);
  padding: var(--app-space-xs);
  background: linear-gradient(#0e0d0c, rgba(14, 13, 12, 0.82));
}
.reader-icon-btn {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  color: #fff;
  border-radius: var(--app-radius-pill);
}
.reader-header__title {
  min-width: 0;
}
.reader-header h1 {
  overflow: hidden;
  margin: 0;
  font-size: var(--app-font-size-md);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reader-header p {
  margin: 0;
  color: #b9b2a6;
  font-size: var(--app-font-size-xs);
}
.reader-stream {
  padding: 0;
  margin: 0;
  list-style: none;
}
.reader-page img {
  display: block;
  width: 100%;
  height: auto;
}
.reader-page__failure {
  display: grid;
  place-content: center;
  justify-items: center;
  min-height: 60dvh;
  color: #8c857a;
  background: #1a1815;
}
.reader-page__failure p {
  margin: var(--app-space-xs) 0;
}
.reader-page__failure button {
  display: inline-flex;
  gap: var(--app-space-3xs);
  align-items: center;
  padding: var(--app-space-2xs);
  color: #d9b48a;
  background: none;
  border: 0;
}
.reader-progress {
  position: fixed;
  z-index: 10;
  right: var(--app-space-sm);
  bottom: var(--app-space-sm);
  left: var(--app-space-sm);
  display: flex;
  align-items: center;
  gap: var(--app-space-2xs);
  padding: var(--app-space-xs);
  color: #b9b2a6;
  font-size: var(--app-font-size-xs);
  background: rgba(14, 13, 12, 0.82);
  border-radius: var(--app-radius-md);
}
.reader-progress__track {
  flex: 1;
  height: 0.1875rem;
  background: rgba(255, 255, 255, 0.22);
}
.reader-progress__track span {
  display: block;
  height: 100%;
  background: #fff;
}
.reader-complete,
.reader-state {
  display: grid;
  justify-items: center;
  align-content: center;
  min-height: 100dvh;
  padding: var(--app-space-lg);
  text-align: center;
}
.reader-complete__check {
  display: grid;
  place-items: center;
  width: 3.75rem;
  height: 3.75rem;
  color: #d9b48a;
  background: rgba(217, 180, 138, 0.15);
  border-radius: var(--app-radius-pill);
}
.reader-complete h2,
.reader-state h1 {
  font-family: var(--app-font-family-serif);
}
.reader-complete p,
.reader-state p {
  color: #b9b2a6;
}
.reader-btn {
  width: 100%;
  padding: var(--app-space-xs);
  color: #fff;
  font-weight: var(--app-font-weight-semibold);
  text-align: center;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--app-radius-md);
}
</style>
