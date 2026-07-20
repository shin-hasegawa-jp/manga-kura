import type { Episode } from '@/domain/models'

// この進捗率以上を読了とみなす
const COMPLETED_THRESHOLD = 0.99

export type ReadingProgressStatus = 'unread' | 'inProgress' | 'completed'

export interface ReadingProgressText {
  status: ReadingProgressStatus
  percent: number
  label: string
}

/**
 * 話の閲覧進捗から、続きから読む導線に使う表示テキストを求める。
 * 未閲覧（最終閲覧日時なし、または進捗0）は unread とし、導線を出さない。
 */
export function getReadingProgressText(
  episode: Pick<Episode, 'scrollProgress' | 'lastReadAt'>,
): ReadingProgressText {
  if (episode.lastReadAt === undefined || episode.scrollProgress <= 0) {
    return { status: 'unread', percent: 0, label: '' }
  }

  if (episode.scrollProgress >= COMPLETED_THRESHOLD) {
    return { status: 'completed', percent: 100, label: '読了' }
  }

  const percent = Math.round(episode.scrollProgress * 100)
  return { status: 'inProgress', percent, label: `続きから ${percent}%` }
}
