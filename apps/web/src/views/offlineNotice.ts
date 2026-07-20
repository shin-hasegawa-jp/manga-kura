export interface OfflineNotice {
  message: string
}

/**
 * 本棚のオフライン通知（納品デザイン17）の表示要否と文言を決める。
 * オフライン時のみ通知を返し、オンライン時は null（非表示）とする。
 */
export function getLibraryOfflineNotice(isOnline: boolean): OfflineNotice | null {
  if (isOnline) {
    return null
  }

  return { message: 'オフライン中。保存済みの漫画はそのまま読めるよ。' }
}

/**
 * 保存画面のオフライン通知の表示要否と文言を決める。
 * 新規保存はページ取得の通信を要するため、オフライン時に不可能と分かる文言を返す。
 */
export function getSaveOfflineNotice(isOnline: boolean): OfflineNotice | null {
  if (isOnline) {
    return null
  }

  return {
    message: 'オフライン中は新しい漫画を保存できないよ。通信できる場所でもう一度試してね。',
  }
}
