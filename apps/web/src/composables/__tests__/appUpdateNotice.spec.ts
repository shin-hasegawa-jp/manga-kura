import { describe, expect, it } from 'vitest'
import { getAppUpdateNotice } from '../appUpdateNotice'

describe('アプリ更新通知の表示判定', () => {
  it('更新待ちがないときは通知を出さない', () => {
    expect(getAppUpdateNotice(false)).toBeNull()
  })

  it('更新待ちがあるときはメッセージと操作ラベルを返す', () => {
    expect(getAppUpdateNotice(true)).toEqual({
      message: 'アプリの新しいバージョンがあります。',
      actionLabel: '更新',
    })
  })
})
