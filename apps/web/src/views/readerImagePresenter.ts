import type { ComicImage } from '@/domain/models'
import type { ObjectUrlRegistry } from '@/utils/objectUrlRegistry'

export interface ReaderImageItem {
  id: string
  displayOrder: number
  width: number
  height: number
  url: string
}

export interface ReaderImagePresenter {
  present(images: readonly ComicImage[]): ReaderImageItem[]
  dispose(): void
}

export function createReaderImagePresenter(objectUrls: ObjectUrlRegistry): ReaderImagePresenter {
  return {
    present(images) {
      objectUrls.revokeAll()
      return [...images]
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((image) => ({
          id: image.id,
          displayOrder: image.displayOrder,
          width: image.width,
          height: image.height,
          url: objectUrls.create(image.blob),
        }))
    },
    dispose() {
      objectUrls.revokeAll()
    },
  }
}
