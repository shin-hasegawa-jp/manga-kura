<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { mdiAlertOutline, mdiChevronLeft, mdiTrashCanOutline } from '@mdi/js'
import { database } from '@/database/database'
import { createMangaRepository } from '@/database/repository'
import { createDeletionService } from '@/database/deletionService'
import { APP_SETTINGS_ID } from '@/database/librarySettingsService'
import { DEFAULT_STORAGE_WARNING_THRESHOLD_BYTES } from '@/domain/models'
import type { StorageUsage } from '@/database/storageUsage'
import { useDeleteConfirm } from '@/composables/useDeleteConfirm'
import { useDeletionNotice } from '@/composables/useDeletionNotice'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { getDeleteConfirmation } from './deleteConfirmation'
import {
  buildStorageListItems,
  formatBytes,
  getEstimatedAvailableBytes,
  getStorageWarningStatus,
  readStorageEstimate,
  type StorageEstimate,
  type StorageListItem,
} from './storageOverview'

const repository = createMangaRepository(database)
const deletionService = createDeletionService(database)
const { notify } = useDeletionNotice()
const {
  target: deleteTarget,
  isDeleting,
  request: requestDelete,
  cancel: cancelDelete,
  confirm: confirmDelete,
} = useDeleteConfirm()
const isLoading = ref(true)
const usage = ref<StorageUsage>()
const estimate = ref<StorageEstimate>()
const warningThresholdBytes = ref(DEFAULT_STORAGE_WARNING_THRESHOLD_BYTES)

const usedBytes = computed(() => usage.value?.totalBytes ?? 0)
const availableBytes = computed(() => getEstimatedAvailableBytes(estimate.value))
const isWarning = computed(
  () => getStorageWarningStatus(usedBytes.value, warningThresholdBytes.value) === 'warning',
)
// 使用量バーの割合（クォータが分かるときだけ表示する）
const usageRatio = computed(() => {
  const quota = estimate.value?.quotaBytes
  if (quota === undefined || quota <= 0) return undefined
  return Math.min(1, usedBytes.value / quota)
})
const storageItems = computed(() => (usage.value ? buildStorageListItems(usage.value) : []))

async function loadStorage() {
  isLoading.value = true
  const [computedUsage, savedEstimate, settings] = await Promise.all([
    repository.storageUsage.compute(),
    readStorageEstimate(),
    repository.settings.findById(APP_SETTINGS_ID),
  ])

  usage.value = computedUsage
  estimate.value = savedEstimate
  warningThresholdBytes.value =
    settings?.storageSettings.warningThresholdBytes ?? DEFAULT_STORAGE_WARNING_THRESHOLD_BYTES
  isLoading.value = false
}

function askDeleteItem(item: StorageListItem) {
  if (item.kind === 'series') {
    requestDelete({ kind: 'series', title: item.title }, async () => {
      await deletionService.deleteSeries(item.id)
      notify('作品を削除しました')
      await loadStorage()
    })
    return
  }
  requestDelete({ kind: 'episode', title: item.title }, async () => {
    await deletionService.deleteEpisode(item.id)
    notify('話を削除しました')
    await loadStorage()
  })
}

function askDeleteAllData() {
  requestDelete({ kind: 'allData' }, async () => {
    await deletionService.deleteAllData()
    notify('すべてのデータを削除しました')
    await loadStorage()
  })
}

onMounted(loadStorage)
</script>

<template>
  <!-- 使用容量の概算を表示する。削除操作はこの画面では扱わない。 -->
  <main class="storage">
    <RouterLink
      class="app-icon-btn storage__back"
      :to="{ name: 'settings' }"
      aria-label="設定へ戻る"
    >
      <AppIcon :path="mdiChevronLeft" :size="28" />
    </RouterLink>
    <h1 class="app-display storage__title">ストレージ管理</h1>

    <p v-if="isLoading" class="app-message app-message--info" role="status">読込中…</p>

    <template v-else-if="usage">
      <!-- 容量警告（納品デザイン25） -->
      <p v-if="isWarning" class="storage-warning" role="alert">
        <AppIcon :path="mdiAlertOutline" :size="20" />
        <span>使用容量が警告のめやすに近づいています。不要な作品や話を整理してね。</span>
      </p>

      <!-- 使用量サマリー（納品デザイン09） -->
      <section class="storage-summary" aria-label="使用容量の概算">
        <div class="storage-summary__head">
          <p class="storage-summary__used">
            <strong>{{ formatBytes(usedBytes) }}</strong> 使用中
          </p>
          <p class="storage-summary__free">
            {{
              availableBytes !== undefined
                ? `空き 約 ${formatBytes(availableBytes)}`
                : '空き容量は不明'
            }}
          </p>
        </div>
        <div
          v-if="usageRatio !== undefined"
          class="storage-summary__bar"
          :class="{ 'storage-summary__bar--warning': isWarning }"
          aria-hidden="true"
        >
          <span :style="{ width: `${Math.round(usageRatio * 100)}%` }"></span>
        </div>
        <dl class="storage-stats">
          <div>
            <dt>作品</dt>
            <dd>{{ usage.seriesCount }}</dd>
          </div>
          <div>
            <dt>話</dt>
            <dd>{{ usage.episodeCount }}</dd>
          </div>
          <div>
            <dt>画像</dt>
            <dd>{{ usage.imageCount }}</dd>
          </div>
        </dl>
      </section>

      <!-- 容量の大きい順の内訳 -->
      <section v-if="storageItems.length > 0" aria-labelledby="storage-breakdown-heading">
        <h2 id="storage-breakdown-heading" class="storage__section-title">容量の大きい順</h2>
        <ul class="storage-list">
          <li v-for="item in storageItems" :key="`${item.kind}-${item.id}`">
            <details v-if="item.kind === 'series' && item.episodes && item.episodes.length > 0">
              <summary class="storage-item">
                <span class="storage-item__body">
                  <span class="storage-item__title">{{ item.title }}</span>
                  <span class="storage-item__meta"
                    >{{ item.episodeCount }}話・{{ item.imageCount }}画像</span
                  >
                </span>
                <span class="storage-item__size">{{ formatBytes(item.bytes) }}</span>
                <button
                  class="storage-item__delete"
                  type="button"
                  :aria-label="`${item.title}を削除`"
                  @click.prevent="askDeleteItem(item)"
                >
                  <AppIcon :path="mdiTrashCanOutline" :size="20" />
                </button>
              </summary>
              <ul class="storage-episode-list">
                <li v-for="episode in item.episodes" :key="episode.episodeId">
                  <span class="storage-episode__title">{{ episode.title }}</span>
                  <span class="storage-episode__size">{{ formatBytes(episode.bytes) }}</span>
                </li>
              </ul>
            </details>
            <div v-else class="storage-item storage-item--static">
              <span class="storage-item__body">
                <span class="storage-item__title">{{ item.title }}</span>
                <span class="storage-item__meta">
                  {{ item.kind === 'series' ? `${item.episodeCount}話` : '単独の話' }}・{{
                    item.imageCount
                  }}画像
                </span>
              </span>
              <span class="storage-item__size">{{ formatBytes(item.bytes) }}</span>
              <button
                class="storage-item__delete"
                type="button"
                :aria-label="`${item.title}を削除`"
                @click="askDeleteItem(item)"
              >
                <AppIcon :path="mdiTrashCanOutline" :size="20" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- 全データ削除（納品デザイン11） -->
      <button
        class="app-btn app-btn--outline app-btn--danger-outline"
        type="button"
        @click="askDeleteAllData"
      >
        すべてのデータを削除
      </button>
    </template>

    <AppConfirmDialog
      v-if="deleteTarget"
      v-bind="getDeleteConfirmation(deleteTarget)"
      :busy="isDeleting"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </main>
</template>

<style scoped>
.storage {
  display: grid;
  gap: var(--app-space-md);
}

.storage__back {
  margin-left: calc(var(--app-space-2xs) * -1);
}

.storage__title {
  margin: 0;
}

.storage__section-title {
  margin: 0 0 var(--app-space-xs);
  font-size: var(--app-font-size-lg);
}

/* ---- 容量警告 ---- */
.storage-warning {
  display: flex;
  gap: var(--app-space-2xs);
  align-items: center;
  margin: 0;
  padding: var(--app-space-xs) var(--app-space-sm);
  color: var(--app-color-error);
  font-size: var(--app-font-size-sm);
  background: var(--app-color-panel);
  border: 1px solid var(--app-color-error);
  border-radius: var(--app-radius-md);
}

/* ---- 使用量サマリー ---- */
.storage-summary {
  display: grid;
  gap: var(--app-space-sm);
  padding: var(--app-space-md);
  background: var(--app-color-surface);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-lg);
}

.storage-summary__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--app-space-2xs);
}

.storage-summary__used {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.storage-summary__used strong {
  color: var(--app-color-text);
  font-size: var(--app-font-size-xl);
}

.storage-summary__free {
  margin: 0;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.storage-summary__bar {
  height: 0.5rem;
  overflow: hidden;
  background: var(--app-color-panel);
  border-radius: var(--app-radius-pill);
}

.storage-summary__bar span {
  display: block;
  height: 100%;
  background: var(--app-color-primary);
  border-radius: inherit;
}

.storage-summary__bar--warning span {
  background: var(--app-color-error);
}

.storage-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--app-space-2xs);
  margin: 0;
  padding-top: var(--app-space-sm);
  border-top: 1px solid var(--app-color-border);
}

.storage-stats div {
  display: grid;
  gap: var(--app-space-3xs);
}

.storage-stats dt {
  order: 2;
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.storage-stats dd {
  order: 1;
  margin: 0;
  font-size: var(--app-font-size-lg);
  font-weight: var(--app-font-weight-bold);
}

/* ---- 内訳一覧 ---- */
.storage-list {
  display: grid;
  gap: var(--app-space-2xs);
  padding: 0;
  margin: 0;
  list-style: none;
}

.storage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-sm);
  padding: var(--app-space-xs) var(--app-space-sm);
  background: var(--app-color-surface);
  border: 1px solid var(--app-color-border);
  border-radius: var(--app-radius-md);
}

details .storage-item {
  cursor: pointer;
}

details[open] .storage-item {
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.storage-item__body {
  display: grid;
  gap: var(--app-space-3xs);
  min-width: 0;
}

.storage-item__title {
  font-weight: var(--app-font-weight-bold);
}

.storage-item__meta {
  color: var(--app-color-text-muted);
  font-size: var(--app-font-size-sm);
}

.storage-item__size {
  flex: 0 0 auto;
  font-weight: var(--app-font-weight-bold);
}

.storage-item__delete {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 2.5rem;
  height: 2.5rem;
  color: var(--app-color-error);
  background: transparent;
  border: 0;
  border-radius: var(--app-radius-sm);
  cursor: pointer;
}

.storage-item__delete:focus-visible {
  outline: 0.1875rem solid var(--app-color-error);
  outline-offset: 0.125rem;
}

.storage-episode-list {
  display: grid;
  gap: var(--app-space-3xs);
  padding: var(--app-space-xs) var(--app-space-sm);
  margin: 0;
  list-style: none;
  background: var(--app-color-panel);
  border: 1px solid var(--app-color-border);
  border-top: 0;
  border-radius: 0 0 var(--app-radius-md) var(--app-radius-md);
}

.storage-episode-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-space-sm);
  font-size: var(--app-font-size-sm);
}

.storage-episode__title {
  min-width: 0;
  color: var(--app-color-text-muted);
}

.storage-episode__size {
  flex: 0 0 auto;
  color: var(--app-color-text-muted);
}
</style>
