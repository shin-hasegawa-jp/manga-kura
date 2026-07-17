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

  it('未知のURLをライブラリへリダイレクトする', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/unknown-page')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('library')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
