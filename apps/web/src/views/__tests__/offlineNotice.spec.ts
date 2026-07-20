import { describe, expect, it } from 'vitest'
import { getLibraryOfflineNotice, getSaveOfflineNotice } from '../offlineNotice'

describe('オフライン通知の表示判定', () => {
  it('オンライン時は本棚のオフライン通知を出さない', () => {
    expect(getLibraryOfflineNotice(true)).toBeNull()
  })

  it('オフライン時は本棚に保存済み漫画を読める旨を表示する', () => {
    expect(getLibraryOfflineNotice(false)).toEqual({
      message: 'オフライン中。保存済みの漫画はそのまま読めるよ。',
    })
  })

  it('オンライン時は保存画面のオフライン通知を出さない', () => {
    expect(getSaveOfflineNotice(true)).toBeNull()
  })

  it('オフライン時は保存画面に新規保存できない旨を表示する', () => {
    expect(getSaveOfflineNotice(false)).toEqual({
      message: 'オフライン中は新しい漫画を保存できないよ。通信できる場所でもう一度試してね。',
    })
  })
})
