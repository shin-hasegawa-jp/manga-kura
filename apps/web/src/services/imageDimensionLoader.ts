import type { ImageCandidate } from './imageCandidateFactory'

export interface ImageDimensions {
  width: number
  height: number
}

export interface ImageDimensionLoaderDependencies {
  loadImageDimensions(url: string): Promise<ImageDimensions>
}

function loadBrowserImageDimensions(url: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight }
      image.onload = null
      image.onerror = null
      resolve(dimensions)
    }
    image.onerror = () => {
      image.onload = null
      image.onerror = null
      reject(new Error('画像を読み込めませんでした。'))
    }
    image.src = url
  })
}

const defaultDependencies: ImageDimensionLoaderDependencies = {
  loadImageDimensions: loadBrowserImageDimensions,
}

function hasValidDimensions(dimensions: ImageDimensions): boolean {
  return (
    Number.isFinite(dimensions.width) &&
    dimensions.width > 0 &&
    Number.isFinite(dimensions.height) &&
    dimensions.height > 0
  )
}

async function loadCandidateDimensions(
  candidate: ImageCandidate,
  dependencies: ImageDimensionLoaderDependencies,
): Promise<ImageCandidate> {
  const loadingCandidate: ImageCandidate = { ...candidate, fetchStatus: 'loading' }

  try {
    const dimensions = await dependencies.loadImageDimensions(candidate.imageUrl)

    if (!hasValidDimensions(dimensions)) {
      return { ...loadingCandidate, fetchStatus: 'failed' }
    }

    return {
      ...loadingCandidate,
      fetchStatus: 'loaded',
      width: dimensions.width,
      height: dimensions.height,
    }
  } catch {
    return { ...loadingCandidate, fetchStatus: 'failed' }
  }
}

export function loadImageCandidateDimensions(
  candidates: readonly ImageCandidate[],
  dependencies: ImageDimensionLoaderDependencies = defaultDependencies,
): Promise<ImageCandidate[]> {
  return Promise.all(
    candidates.map((candidate) => loadCandidateDimensions(candidate, dependencies)),
  )
}
