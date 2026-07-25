import type { ComicImage, Episode, Series } from '@/domain/models'
import type { MangaKuraDatabase } from '@/database/database'
import type { RegistrationImageSource } from '@/database/registrationService'
import {
  createImageContentHash,
  getImageDuplicateReasons,
  type ImageDuplicateReason,
} from './imageFingerprint'

export interface DuplicateImageMatch {
  incomingIndex: number
  reasons: readonly ImageDuplicateReason[]
  target:
    | { kind: 'batch'; imageIndex: number }
    | {
        kind: 'saved'
        imageId: string
        imagePosition: number
        episodeId: string
        episodeTitle: string
        seriesTitle?: string
      }
}

export interface ImageDuplicateDetectionResult {
  images: RegistrationImageSource[]
  matches: DuplicateImageMatch[]
}

interface SavedImageContext {
  image: ComicImage
  episode: Episode
  series?: Series
}

export interface ImageDuplicateDetectorDependencies {
  savedImages(): AsyncIterable<SavedImageContext>
  saveComputedHash?(image: ComicImage, contentHash: string): Promise<void>
}

export async function detectImageDuplicates(
  incomingImages: readonly RegistrationImageSource[],
  dependencies: ImageDuplicateDetectorDependencies,
): Promise<ImageDuplicateDetectionResult> {
  const images: RegistrationImageSource[] = []
  const matches: DuplicateImageMatch[] = []

  for (const [incomingIndex, image] of incomingImages.entries()) {
    const contentHash = image.contentHash ?? (await createImageContentHash(image.blob))
    const fingerprintedImage = { ...image, contentHash }

    for (const [imageIndex, previous] of images.entries()) {
      const reasons = getImageDuplicateReasons(fingerprintedImage, previous)
      if (reasons.length > 0) {
        matches.push({ incomingIndex, reasons, target: { kind: 'batch', imageIndex } })
      }
    }
    images.push(fingerprintedImage)
  }

  for await (const context of dependencies.savedImages()) {
    const contentHash =
      context.image.contentHash ?? (await createImageContentHash(context.image.blob))
    if (context.image.contentHash === undefined) {
      await dependencies.saveComputedHash?.(context.image, contentHash)
    }
    const savedImage = { ...context.image, contentHash }

    for (const [incomingIndex, image] of images.entries()) {
      const reasons = getImageDuplicateReasons(image, savedImage)
      if (reasons.length === 0) continue
      matches.push({
        incomingIndex,
        reasons,
        target: {
          kind: 'saved',
          imageId: savedImage.id,
          imagePosition: savedImage.displayOrder + 1,
          episodeId: context.episode.id,
          episodeTitle: context.episode.title,
          ...(context.series === undefined ? {} : { seriesTitle: context.series.title }),
        },
      })
    }
  }

  return { images, matches }
}

export function createDatabaseImageDuplicateDetector(database: MangaKuraDatabase) {
  return (images: readonly RegistrationImageSource[]) =>
    detectImageDuplicates(images, {
      async *savedImages() {
        const imageIds = await database.images.toCollection().primaryKeys()
        for (const imageId of imageIds) {
          const image = await database.images.get(imageId)
          if (image === undefined) continue
          const episode = await database.episodes.get(image.episodeId)
          if (episode === undefined) continue
          const series =
            episode.seriesId === undefined ? undefined : await database.series.get(episode.seriesId)
          yield { image, episode, series }
        }
      },
      async saveComputedHash(image, contentHash) {
        await database.images.put({ ...image, contentHash })
      },
    })
}
