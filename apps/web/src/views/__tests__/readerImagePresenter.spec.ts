import { describe, expect, it, vi } from 'vitest'
import type { ComicImage } from '@/domain/models'
import type { ObjectUrlRegistry } from '@/utils/objectUrlRegistry'
import { createReaderImagePresenter } from '../readerImagePresenter'

function image(id: string, displayOrder: number): ComicImage {
  return {
    id,
    episodeId: 'episode-1',
    displayOrder,
    blob: new Blob([id], { type: 'image/png' }),
    sourceUrl: `https://example.com/${id}.png`,
    mimeType: 'image/png',
    fileSize: id.length,
    width: 100,
    height: 200,
    createdAt: new Date('2026-07-19T00:00:00.000Z'),
  }
}

describe('漫画閲覧画像の表示変換', () => {
  it('DOM順にObject URLを生成し、再変換と破棄でURLを解放する', () => {
    const objectUrls: ObjectUrlRegistry = {
      create: vi.fn((blob) => `blob:${blob.size}`),
      revokeAll: vi.fn(),
    }
    const presenter = createReaderImagePresenter(objectUrls)

    expect(presenter.present([image('second', 1), image('first', 0)])).toEqual([
      { id: 'first', displayOrder: 0, width: 100, height: 200, url: 'blob:5' },
      { id: 'second', displayOrder: 1, width: 100, height: 200, url: 'blob:6' },
    ])
    presenter.present([])
    presenter.dispose()

    expect(objectUrls.revokeAll).toHaveBeenCalledTimes(3)
  })
})
