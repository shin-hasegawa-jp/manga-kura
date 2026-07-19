import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'

describe('アプリケーションルーター', () => {
  it.each([
    ['/', 'library'],
    ['/save', 'save'],
    ['/storage', 'storage'],
    ['/settings', 'settings'],
  ])('%s を %s ルートとして解決する', async (path, routeName) => {
    const router = createAppRouter(createMemoryHistory())

    await router.push(path)
    await router.isReady()

    expect(router.currentRoute.value.name).toBe(routeName)
  })

  it('作品IDを含むURLを作品詳細ルートとして解決する', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/series/development-series-1')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('seriesDetail')
    expect(router.currentRoute.value.params).toEqual({ seriesId: 'development-series-1' })
  })

  it('作品IDと話IDを含むURLを作品配下の漫画閲覧ルートとして解決する', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/series/series-1/episodes/episode-1')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('seriesEpisodeReader')
    expect(router.currentRoute.value.params).toEqual({
      seriesId: 'series-1',
      episodeId: 'episode-1',
    })
  })

  it('話IDを含むURLを単独話の漫画閲覧ルートとして解決する', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/episodes/episode-1')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('standaloneEpisodeReader')
    expect(router.currentRoute.value.params).toEqual({ episodeId: 'episode-1' })
  })

  it('作品IDを含まない作品URLをライブラリへリダイレクトする', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/series')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('library')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('未知のURLをライブラリへリダイレクトする', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/unknown-page')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('library')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it.each(['/reader', '/reader/episode-1', '/episodes', '/series/series-1/episodes'])(
    '廃止または識別子不足のURL %s をライブラリへリダイレクトする',
    async (path) => {
      const router = createAppRouter(createMemoryHistory())

      await router.push(path)
      await router.isReady()

      expect(router.currentRoute.value.name).toBe('library')
      expect(router.currentRoute.value.path).toBe('/')
    },
  )
})
