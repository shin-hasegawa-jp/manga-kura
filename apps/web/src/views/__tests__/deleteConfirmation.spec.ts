import { describe, expect, it } from 'vitest'
import { getDeleteConfirmation } from '../deleteConfirmation'

describe('削除確認の内容', () => {
  it('作品の削除では所属する話と画像もまとめて削除することを示す', () => {
    const confirmation = getDeleteConfirmation({ kind: 'series', title: '冒険譚' })

    expect(confirmation.confirmLabel).toBe('作品ごと削除')
    expect(confirmation.message).toContain('冒険譚')
    expect(confirmation.message).toContain('所属するすべての話・画像')
    expect(confirmation.message).toContain('取り消せません')
  })

  it('話の削除では対象タイトルとその画像の削除を示す', () => {
    const confirmation = getDeleteConfirmation({ kind: 'episode', title: '第1話' })

    expect(confirmation.confirmLabel).toBe('話を削除')
    expect(confirmation.message).toContain('第1話')
    expect(confirmation.title).toBe('話を削除しますか？')
  })

  it('全データ削除の確認内容を返す', () => {
    const confirmation = getDeleteConfirmation({ kind: 'allData' })

    expect(confirmation.title).toBe('すべてのデータを削除しますか？')
    expect(confirmation.confirmLabel).toBe('すべて削除')
    expect(confirmation.message).toContain('すべての作品・話・画像')
  })

  it('画像削除はタイトルの有無で説明を切り替える', () => {
    expect(getDeleteConfirmation({ kind: 'image', title: '第1話' }).message).toContain('第1話')
    expect(getDeleteConfirmation({ kind: 'image' }).message).toBe(
      'この画像を削除します。この操作は取り消せません。',
    )
  })
})
