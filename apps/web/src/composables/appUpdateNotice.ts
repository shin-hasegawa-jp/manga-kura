export interface AppUpdateNotice {
  message: string
  actionLabel: string
}

/**
 * アプリ更新通知の表示要否と内容を決める。
 * 新しいService Workerが待機している（needRefresh）ときだけ通知を返し、
 * それ以外は null（非表示）とする。表示ロジックをSW実体から切り離して単体テスト可能にする。
 */
export function getAppUpdateNotice(needRefresh: boolean): AppUpdateNotice | null {
  if (!needRefresh) {
    return null
  }

  return {
    message: 'アプリの新しいバージョンがあります。',
    actionLabel: '更新',
  }
}
