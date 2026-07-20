import type { DuplicateRegistration } from '@/database/duplicateUrl'

export interface DuplicateRegistrationView {
  episodeId: string
  title: string
  registeredAtLabel: string
}

/**
 * 登録日時を「2026年7月14日」の形式へ整える。
 */
export function formatRegisteredAt(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

/**
 * 重複登録の情報を、警告表示用（登録済みタイトルと登録日時）へ変換する。
 */
export function toDuplicateRegistrationViews(
  registrations: readonly DuplicateRegistration[],
): DuplicateRegistrationView[] {
  return registrations.map((registration) => ({
    episodeId: registration.episodeId,
    title: registration.title,
    registeredAtLabel: formatRegisteredAt(registration.registeredAt),
  }))
}
