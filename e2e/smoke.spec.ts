import { expect, test } from '@playwright/test';

test('loads without runtime errors and links every live app', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Huishouden' })).toBeVisible();
  const links = await page.locator('a.tile').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(links.length).toBeGreaterThan(0);
  for (const href of links) expect((await page.request.get(href)).ok(), href).toBe(true);
  expect(errors).toEqual([]);
});

test('is installable: manifest with icons and an active service worker', async ({ page, request }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const href = await page.locator('link[rel="manifest"]').first().getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { sizes: string }) => i.sizes.includes('512x512'))).toBe(true);
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await page.reload({ waitUntil: 'networkidle' });
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
});
