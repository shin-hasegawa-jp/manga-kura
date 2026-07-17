import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'

describe('アプリケーションルーター', () => {
  it.each([
    ['/', 'library'],
    ['/save', 'save'],
    ['/reader', 'reader'],
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
})
