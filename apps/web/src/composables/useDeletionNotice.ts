import { ref } from 'vue'

// 画面をまたいでも表示できるよう、モジュール共有の状態にする
const message = ref('')
let timer: ReturnType<typeof setTimeout> | undefined

export function useDeletionNotice() {
  function notify(text: string) {
    message.value = text
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      message.value = ''
    }, 4000)
  }

  function dismiss() {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    message.value = ''
  }

  return { message, notify, dismiss }
}
