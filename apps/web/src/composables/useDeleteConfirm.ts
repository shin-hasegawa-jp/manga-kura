import { ref } from 'vue'
import type { DeleteTarget } from '@/views/deleteConfirmation'

/**
 * 削除確認の状態を管理する。確定するまで削除処理は実行しない。
 * request で対象と実行処理を受け取り、confirm で初めて実行する。
 */
export function useDeleteConfirm() {
  const target = ref<DeleteTarget>()
  const isDeleting = ref(false)
  let runner: (() => Promise<void>) | undefined

  function request(nextTarget: DeleteTarget, run: () => Promise<void>) {
    target.value = nextTarget
    runner = run
  }

  function cancel() {
    if (isDeleting.value) return
    target.value = undefined
    runner = undefined
  }

  async function confirm() {
    if (runner === undefined || isDeleting.value) return

    isDeleting.value = true
    try {
      await runner()
    } finally {
      isDeleting.value = false
      target.value = undefined
      runner = undefined
    }
  }

  return { target, isDeleting, request, cancel, confirm }
}
