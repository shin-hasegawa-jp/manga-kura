<script setup lang="ts">
import { mdiImageOffOutline } from '@mdi/js'
import AppIcon from './AppIcon.vue'

/**
 * サムネイル共通表示。画像があれば表示し、なければ「画像なし」状態を出す。
 * 本棚カード・作品詳細の話・保存完了などで共通利用する。
 */
withDefaults(
  defineProps<{
    src?: string
    /** 何のサムネイルかを伝える名前（画像ありのalt文に使う） */
    label: string
    /** アスペクト比（例: '1 / 1', '3 / 4'）。既定は正方形 */
    ratio?: string
  }>(),
  { src: undefined, ratio: '1 / 1' },
)
</script>

<template>
  <img
    v-if="src"
    class="app-thumbnail"
    :style="{ aspectRatio: ratio }"
    :src="src"
    :alt="`${label}のサムネイル`"
  />
  <div
    v-else
    class="app-thumbnail app-thumbnail--placeholder"
    :style="{ aspectRatio: ratio }"
    role="img"
    :aria-label="`${label}（画像なし）`"
  >
    <AppIcon :path="mdiImageOffOutline" :size="20" />
    <span class="app-thumbnail__placeholder-text">画像なし</span>
  </div>
</template>

<style scoped>
.app-thumbnail {
  display: block;
  width: 100%;
  object-fit: cover;
  background: var(--app-color-panel);
  border-radius: var(--app-radius-md);
}

.app-thumbnail--placeholder {
  display: grid;
  place-items: center;
  gap: var(--app-space-3xs);
  color: var(--app-color-text-muted);
}

.app-thumbnail__placeholder-text {
  font-size: var(--app-font-size-xs);
}
</style>
