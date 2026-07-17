import { createRouter, createWebHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'

export function createAppRouter(
  history: RouterHistory = createWebHistory(import.meta.env.BASE_URL),
) {
  return createRouter({
    history,
    routes: [
      {
        path: '/',
        name: 'library',
        component: () => import('../views/LibraryView.vue'),
      },
      {
        path: '/save',
        name: 'save',
        component: () => import('../views/SaveView.vue'),
      },
      {
        path: '/series/:seriesId',
        name: 'seriesDetail',
        component: () => import('../views/SeriesDetailView.vue'),
      },
      {
        path: '/reader',
        name: 'reader',
        component: () => import('../views/ReaderView.vue'),
      },
      {
        path: '/storage',
        name: 'storage',
        component: () => import('../views/StorageView.vue'),
      },
      {
        path: '/settings',
        name: 'settings',
        component: () => import('../views/SettingsView.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        redirect: { name: 'library' },
      },
    ],
  })
}

const router = createAppRouter()

export default router
