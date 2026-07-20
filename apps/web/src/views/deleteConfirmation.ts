export type DeleteTarget =
  | { kind: 'series'; title: string }
  | { kind: 'episode'; title: string }
  | { kind: 'image'; title?: string }
  | { kind: 'allData' }

export interface DeleteConfirmation {
  title: string
  message: string
  confirmLabel: string
}

/**
 * 削除対象ごとに、確認ダイアログの見出し・説明・確定ボタン文言を決める。
 * 作品の削除では所属する話と画像もまとめて削除することを明示する。
 */
export function getDeleteConfirmation(target: DeleteTarget): DeleteConfirmation {
  switch (target.kind) {
    case 'series':
      return {
        title: '作品を削除しますか？',
        message: `「${target.title}」と、所属するすべての話・画像を削除します。この操作は取り消せません。`,
        confirmLabel: '作品ごと削除',
      }
    case 'episode':
      return {
        title: '話を削除しますか？',
        message: `「${target.title}」と、その画像を削除します。この操作は取り消せません。`,
        confirmLabel: '話を削除',
      }
    case 'image':
      return {
        title: '画像を削除しますか？',
        message: target.title
          ? `「${target.title}」の画像を削除します。この操作は取り消せません。`
          : 'この画像を削除します。この操作は取り消せません。',
        confirmLabel: '画像を削除',
      }
    case 'allData':
      return {
        title: 'すべてのデータを削除しますか？',
        message: '保存したすべての作品・話・画像を削除します。この操作は取り消せません。',
        confirmLabel: 'すべて削除',
      }
  }
}
