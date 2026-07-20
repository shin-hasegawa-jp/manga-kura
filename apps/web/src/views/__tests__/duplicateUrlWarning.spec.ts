import { describe, expect, it } from 'vitest'
import { formatRegisteredAt, toDuplicateRegistrationViews } from '../duplicateUrlWarning'

describe('重複URL警告の表示データ', () => {
  it('登録日時を日本語の年月日へ整える', () => {
    expect(formatRegisteredAt(new Date(2026, 6, 14))).toBe('2026年7月14日')
    expect(formatRegisteredAt(new Date(2026, 11, 1))).toBe('2026年12月1日')
  })

  it('重複登録を登録済みタイトルと登録日時ラベルへ変換する', () => {
    expect(
      toDuplicateRegistrationViews([
        { episodeId: 'ep-2', title: '再保存した話', registeredAt: new Date(2026, 6, 18) },
        { episodeId: 'ep-1', title: '第1話', registeredAt: new Date(2026, 6, 14) },
      ]),
    ).toEqual([
      { episodeId: 'ep-2', title: '再保存した話', registeredAtLabel: '2026年7月18日' },
      { episodeId: 'ep-1', title: '第1話', registeredAtLabel: '2026年7月14日' },
    ])
  })
})
