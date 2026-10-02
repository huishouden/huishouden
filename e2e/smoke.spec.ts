import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectInstallable } from '@piekstra/pwa-kit/e2e';

test('loads without runtime errors and links every live app', async ({ page }) => {
  await expectCleanLoad(page);
  await expect(page.getByRole('heading', { name: 'Huishouden' })).toBeVisible();
  const links = await page.locator('a.tile').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) expect((await page.request.get(href)).ok(), href).toBe(true);
});

test('is installable', ({ page, request }) => expectInstallable(page, request));
