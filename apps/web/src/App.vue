<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'
</script>

<template>
  <v-app>
    <v-app-bar border="b" color="surface" flat>
      <v-app-bar-title>漫画蔵</v-app-bar-title>
    </v-app-bar>

    <v-main class="app-main">
      <div class="app-content">
        <RouterView />
      </div>
    </v-main>

    <AppNavigation />
  </v-app>
</template>

<style scoped>
.app-main {
  padding-bottom: 4.5rem;
}

.app-content {
  width: min(100%, 48rem);
  min-height: 100%;
  margin: 0 auto;
  padding: 1rem;
}
</style>
