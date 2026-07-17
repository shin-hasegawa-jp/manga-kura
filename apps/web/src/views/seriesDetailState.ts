import type { SeriesDetails } from '@/database/repository'

export type SeriesDetailState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'empty'; details: SeriesDetails }
  | { kind: 'populated'; details: SeriesDetails }

export function getSeriesDetailState(
  isLoading: boolean,
  details: SeriesDetails | undefined,
): SeriesDetailState {
  if (isLoading) {
    return { kind: 'loading' }
  }

  if (details === undefined) {
    return { kind: 'notFound' }
  }

  if (details.episodes.length === 0) {
    return { kind: 'empty', details }
  }

  return { kind: 'populated', details }
}
