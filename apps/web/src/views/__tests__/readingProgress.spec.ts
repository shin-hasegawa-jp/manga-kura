import { describe, expect, it } from 'vitest'
import { getReadingProgressText } from '../readingProgress'

const readAt = new Date('2026-07-20T05:00:00.000Z')

describe('閲覧進捗の表示テキスト', () => {
  it('最終閲覧日時がない話は未閲覧として導線を出さない', () => {
    expect(getReadingProgressText({ scrollProgress: 0.4, lastReadAt: undefined })).toEqual({
      status: 'unread',
      percent: 0,
      label: '',
    })
  })

  it('進捗が0の話は未閲覧として扱う', () => {
    expect(getReadingProgressText({ scrollProgress: 0, lastReadAt: readAt })).toEqual({
      status: 'unread',
      percent: 0,
      label: '',
    })
  })

  it('閲覧途中の話は進捗率つきの続きから読む導線にする', () => {
    expect(getReadingProgressText({ scrollProgress: 0.42, lastReadAt: readAt })).toEqual({
      status: 'inProgress',
      percent: 42,
      label: '続きから 42%',
    })
  })

  it('最後まで読んだ話は読了として扱う', () => {
    expect(getReadingProgressText({ scrollProgress: 1, lastReadAt: readAt })).toEqual({
      status: 'completed',
      percent: 100,
      label: '読了',
    })
  })
})
