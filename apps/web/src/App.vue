<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { useRoute } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'

const route = useRoute()
const isReader = computed(() => route.meta.reader === true)
</script>

<template>
  <v-app>
    <v-main>
      <!-- 各画面が自身のヘッダー（大見出し／戻る）を持つため、共通の固定ヘッダーは置かず、
           コンテンツ領域だけをスマートフォン縦向きの納品デザインへ合わせる。 -->
      <div class="app-content" :class="{ 'app-content--reader': isReader }">
        <RouterView />
      </div>
    </v-main>

    <AppNavigation v-if="!isReader" />
  </v-app>
</template>

<style scoped>
.app-content {
  width: min(100%, var(--app-content-max-width));
  min-height: 100%;
  margin: 0 auto;
  /* 上：端末セーフエリア、左右：画面外周余白、
     下：固定ナビゲーション＋セーフエリアにコンテンツが隠れない余白 */
  padding-top: calc(env(safe-area-inset-top) + var(--app-space-sm));
  padding-right: var(--app-content-padding-inline);
  padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
  padding-left: var(--app-content-padding-inline);
}

.app-content--reader {
  width: 100%;
  max-width: var(--app-content-max-width);
  padding: 0;
}
</style>
