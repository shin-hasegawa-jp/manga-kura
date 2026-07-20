<script setup lang="ts">
/**
 * 作品／単独の話の種別バッジ。本棚カードと作品詳細で共通利用する。
 * 色だけに依存せず、ラベル文言（作品／話）で種別を判別できるようにする。
 */
const props = defineProps<{
  kind: 'series' | 'standalone'
}>()

const label = props.kind === 'series' ? '作品' : '話'
</script>

<template>
  <span class="app-badge" :data-kind="kind">{{ label }}</span>
</template>

<style scoped>
.app-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1875rem var(--app-space-2xs);
  color: var(--app-color-on-cta);
  font-size: var(--app-font-size-xs);
  font-weight: var(--app-font-weight-bold);
  background: var(--app-color-cta);
  border-radius: var(--app-radius-sm);
}
</style>
