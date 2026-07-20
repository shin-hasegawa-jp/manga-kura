import type { Episode } from '@/domain/models'
import type { MangaRepository } from './repository'

export interface DuplicateRegistration {
  episodeId: string
  title: string
  registeredAt: Date
}

/**
 * 同一URLの既存話を、登録済みタイトルと登録日時へ整理する。
 * 登録日時の新しい順に並べ、重複がなければ空配列を返す。
 */
export function toDuplicateRegistrations(episodes: readonly Episode[]): DuplicateRegistration[] {
  return episodes
    .map((episode) => ({
      episodeId: episode.id,
      title: episode.title,
      registeredAt: episode.createdAt,
    }))
    .sort((left, right) => right.registeredAt.getTime() - left.registeredAt.getTime())
}

/**
 * 保存対象の掲載元ページURLと同じURLの既存話を検出する。
 * 重複なし＝空配列、単一・複数重複＝登録済み情報の一覧を返す。
 */
export async function findDuplicateRegistrations(
  repository: MangaRepository,
  sourcePageUrl: string,
): Promise<DuplicateRegistration[]> {
  const episodes = await repository.episodes.findAllBySourcePageUrl(sourcePageUrl)

  return toDuplicateRegistrations(episodes)
}
