import { computed } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { getAppUpdateNotice } from './appUpdateNotice'

/**
 * Service Workerを登録し、新しいバージョンが待機したときの更新通知を提供する。
 * registerType: 'prompt' のため自動リロードはせず、ユーザーが更新を選ぶまで
 * 既存の表示・操作を壊さない。表示内容の決定は getAppUpdateNotice（純関数）へ委ねる。
 */
export function useAppUpdate() {
  const { needRefresh, updateServiceWorker } = useRegisterSW()

  const notice = computed(() => getAppUpdateNotice(needRefresh.value))

  function applyUpdate() {
    // 新しいService Workerを有効化し、ページを再読み込みして最新版へ更新する。
    void updateServiceWorker(true)
  }

  return { notice, applyUpdate }
}
