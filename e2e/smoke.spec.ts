import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable } from '@huishouden/pwa-kit/e2e';
import { readFileSync } from 'node:fs';

const registry: { site: string; tile?: boolean }[] = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));

test('loads without runtime errors and has a working tile for every app in apps.json', async ({ page }) => {
  await expectCleanLoad(page);
  await expectHuishoudenFrame(page, { app: 'Huishouden', portalUrl: '/' });
  const links = await page.locator('a.tile').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  const expected = registry.filter((app) => app.tile !== false).map((app) => `https://${app.site}.web.app/`);
  expect(links).toEqual(expected);
  for (const href of links) expect((await page.request.get(href)).ok(), href).toBe(true);
});

test('is installable', ({ page, request }) => expectInstallable(page, request));

test('household panel offers Google sign-in that reaches Google', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.locator('#household').getByRole('button', { name: 'Sign in with Google' }).click();
  }));

test('the app bar offers Google sign-in that reaches Google', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.locator('hh-app-bar').getByRole('button', { name: 'Sign in with Google' }).click();
  }));

test('signed out, the household panel explains Huishouden and how to start', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const panel = page.locator('#household');
  await expect(panel.getByRole('heading', { name: 'Simple shared apps for running a home together' })).toBeVisible();
  await expect(panel.getByText("It's free.", { exact: false })).toBeVisible();
  await expect(panel.getByText("A household's information is visible only to its members.")).toBeVisible();
  await expect(panel.getByRole('listitem')).toHaveText([
    'Sign in with your Google account.',
    'Start a household, or join the one you were invited to.',
    'Open any app. Add it to your home screen to keep it close.',
  ]);
});
