import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import vuetify from 'vite-plugin-vuetify'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    vueDevTools(),
    VitePWA({
      // 新しいService Workerは自動有効化せず、アプリ更新通知（7-4）から明示的に適用する。
      registerType: 'prompt',
      // アプリ本体（HTML/JS/CSS/アイコン）をオフライン起動のためにキャッシュする。
      includeAssets: ['favicon.ico', 'app-icon.svg'],
      manifest: {
        name: '漫画蔵',
        short_name: '漫画蔵',
        description: '公開されている昔のWeb漫画を、端末内に保存してオフラインでも読めるアプリ。',
        lang: 'ja',
        // 納品デザイン（3.6）の配色に合わせる。
        theme_color: '#b5643c',
        background_color: '#fbfaf8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      devOptions: {
        // 開発サーバーではService Workerを無効化し、既存のdev体験を変えない。
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
