import type { RouteLocationRaw } from 'vue-router'
import type { Episode } from '@/domain/models'

export type ReaderRouteTarget =
  | { kind: 'seriesEpisode'; seriesId: string; episodeId: string }
  | { kind: 'standaloneEpisode'; episodeId: string }

export function getSeriesEpisodeReaderRoute(seriesId: string, episodeId: string): RouteLocationRaw {
  return { name: 'seriesEpisodeReader', params: { seriesId, episodeId } }
}

export function getStandaloneEpisodeReaderRoute(episodeId: string): RouteLocationRaw {
  return { name: 'standaloneEpisodeReader', params: { episodeId } }
}

export function getEpisodeReaderRoute(episode: Episode): RouteLocationRaw {
  return episode.seriesId
    ? getSeriesEpisodeReaderRoute(episode.seriesId, episode.id)
    : getStandaloneEpisodeReaderRoute(episode.id)
}

function getStringParameter(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return undefined

  const firstValue: unknown = value[0]
  return typeof firstValue === 'string' ? firstValue : undefined
}

export function getReaderRouteTarget(
  routeName: unknown,
  seriesIdParameter: unknown,
  episodeIdParameter: unknown,
): ReaderRouteTarget | undefined {
  const episodeId = getStringParameter(episodeIdParameter)
  if (!episodeId) return undefined

  if (routeName === 'standaloneEpisodeReader') {
    return { kind: 'standaloneEpisode', episodeId }
  }

  const seriesId = getStringParameter(seriesIdParameter)
  if (routeName === 'seriesEpisodeReader' && seriesId) {
    return { kind: 'seriesEpisode', seriesId, episodeId }
  }

  return undefined
}

export function isReaderRouteTargetValid(target: ReaderRouteTarget, episode: Episode): boolean {
  if (target.episodeId !== episode.id) return false

  return target.kind === 'seriesEpisode'
    ? episode.seriesId === target.seriesId
    : episode.seriesId === undefined
}
