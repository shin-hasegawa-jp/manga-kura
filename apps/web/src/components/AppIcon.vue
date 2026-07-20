<script setup lang="ts">
/**
 * MDIのパスデータ（@mdi/js）をインラインSVGで描画する共通アイコン。
 * Vuetifyの v-icon に依存しないため、ビューのモジュールグラフへ
 * VuetifyコンポーネントのCSSを持ち込まず、単体テストでも読み込める。
 */
withDefaults(
  defineProps<{
    /** @mdi/js のパス文字列 */
    path: string
    size?: number | string
    /** 指定すると読み上げ対象（role=img）。未指定は装飾扱い */
    label?: string
  }>(),
  { size: 24, label: undefined },
)
</script>

<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <path :d="path" fill="currentColor" />
  </svg>
</template>

<style scoped>
.app-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
}
</style>
