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
      workbox: {
        // アプリ本体の静的資産のみプリキャッシュする。同梱フォント（woff2, 約17MB/620ファイル）は
        // 初回インストールを軽く保つためプリキャッシュに含めず、下記のランタイムキャッシュで
        // 使用時に取り込む。未取得時はデザイン方針どおりシステムフォントへフォールバックする。
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        // SPAのため、未キャッシュの画面遷移はアプリシェル（index.html）へフォールバックする。
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // 同梱フォントは使用時にキャッシュし、次回以降はオフラインでも表示できるようにする。
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-fonts',
              expiration: { maxEntries: 700, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // 取得APIや対象サイトへの通信はキャッシュ対象にしない（オンライン必須方針を維持）。
        // クロスオリジンのfetchはService Workerを素通りしてネットワークへ向かう。
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
