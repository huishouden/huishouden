import { expect, test } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';

// README images, refreshed by CI after each deploy (only committed when they change).
test('home', ({ page }) => captureScreenshot(page, 'home', { fixedTime: '2026-10-01T09:00:00' }));

test('phone: home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-home', { fixedTime: '2026-10-01T09:00:00' });
});

// The app bar with an invented signed-in person and the account menu open.
test('account menu', ({ page }) =>
  captureScreenshot(page, 'account-menu', {
    fixedTime: '2026-10-01T09:00:00',
    prepare: async (p) => {
      await p.locator('hh-app-bar').evaluate((bar: HTMLElementTagNameMap['hh-app-bar']) => {
        bar.user = { name: 'Sam Example', email: 'sam@example.com', photoURL: null };
      });
      await p.getByRole('button', { name: 'Signed in as sam@example.com' }).click();
      await expect(p.getByText('sam@example.com', { exact: true })).toBeVisible();
    },
  }));
