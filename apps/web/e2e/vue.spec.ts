import { test, expect } from '@playwright/test'

test('アプリケーションのルートURLを表示する', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('You did it!')
})
