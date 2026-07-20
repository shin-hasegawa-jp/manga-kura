import { readonly, ref } from 'vue'

// 画面をまたいで同じ状態を参照できるよう、モジュール共有の状態にする。
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
let initialized = false

function update() {
  isOnline.value = navigator.onLine
}

function ensureListeners() {
  if (initialized || typeof window === 'undefined') {
    return
  }
  initialized = true
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
}

/**
 * オンライン/オフライン状態を提供する。navigator.onLine を初期値とし、
 * online/offline イベントで更新する。判定結果の表示要否は純関数（offlineNotice）へ委ねる。
 */
export function useOnlineStatus() {
  ensureListeners()
  // 参照先が状態を書き換えないよう読み取り専用で返す。
  return { isOnline: readonly(isOnline) }
}
