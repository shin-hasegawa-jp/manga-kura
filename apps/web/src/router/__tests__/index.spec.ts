import { describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import { createAppRouter } from '../index'

describe('app router', () => {
  it.each([
    ['/', 'library'],
    ['/save', 'save'],
    ['/reader', 'reader'],
    ['/storage', 'storage'],
    ['/settings', 'settings'],
  ])('resolves %s to the %s route', async (path, routeName) => {
    const router = createAppRouter(createMemoryHistory())

    await router.push(path)
    await router.isReady()

    expect(router.currentRoute.value.name).toBe(routeName)
  })

  it('redirects an unknown URL to the library', async () => {
    const router = createAppRouter(createMemoryHistory())

    await router.push('/unknown-page')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('library')
    expect(router.currentRoute.value.path).toBe('/')
  })
})
