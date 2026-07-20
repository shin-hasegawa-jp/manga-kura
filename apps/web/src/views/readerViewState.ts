import type { ComicImage, Episode, Series } from '@/domain/models'

export type ReaderViewState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'empty'; episode: Episode; series?: Series }
  | { kind: 'ready'; episode: Episode; series?: Series; images: readonly ComicImage[] }

export function getReaderViewState(
  isLoading: boolean,
  episode: Episode | undefined,
  series: Series | undefined,
  images: readonly ComicImage[],
): ReaderViewState {
  if (isLoading) return { kind: 'loading' }
  if (episode === undefined) return { kind: 'notFound' }

  const context = { episode, ...(series ? { series } : {}) }
  if (images.length === 0) return { kind: 'empty', ...context }

  return { kind: 'ready', ...context, images }
}

export function getReaderBackRoute(
  episode: Episode,
): { name: 'seriesDetail'; params: { seriesId: string } } | { name: 'library' } {
  return episode.seriesId
    ? { name: 'seriesDetail', params: { seriesId: episode.seriesId } }
    : { name: 'library' }
}
