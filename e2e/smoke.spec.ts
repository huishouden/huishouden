import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable } from '@huishouden/pwa-kit/e2e';
import { readFileSync } from 'node:fs';

const registry: { repo: string; site: string; tile?: boolean }[] = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));
const tileApps = registry.filter((app) => app.tile !== false);
const urlOf = (app: { site: string }) => `https://${app.site}.web.app/`;

test('loads without runtime errors and has a working tile for every app in apps.json, in its order', async ({ page }) => {
  await expectCleanLoad(page);
  await expectHuishoudenFrame(page, { app: 'Huishouden', portalUrl: '/' });
  const tiles = page.getByRole('navigation', { name: 'Household apps' }).locator('a.tile');
  const links = await tiles.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(links).toEqual(tileApps.map(urlOf));
  // Simple everyday apps first; Spending needs setup; Baby isn't for every household. New apps follow.
  const names = await tiles.locator('.tile__name').allTextContents();
  expect(names.slice(0, 7)).toEqual(['Tasks', 'Home', 'Pet', 'Car', 'Bills', 'Spending', 'Baby']);
  await expect(page.getByText('More apps')).toHaveCount(0);
  for (const href of links) expect((await page.request.get(href)).ok(), href).toBe(true);
});

// A household's layout comes from Firestore once a member signs in, which E2E can't do; this gives
// the tiles an invented layout directly (`<hh-tiles>.view`), the same way the screenshots do.
test('apps a household hides stay reachable under More apps', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('#household').getByRole('heading', { name: 'How it works' })).toBeVisible();
  const hidden = tileApps.slice(-2).map((a) => a.repo);
  await page.locator('hh-tiles').evaluate((el: HTMLElementTagNameMap['hh-tiles'], hidden) => {
    el.view = { ...el.view, layout: { order: [], hidden }, canArrange: true };
  }, hidden);
  const shown = page.getByRole('navigation', { name: 'Household apps' }).locator('a.tile');
  await expect(shown).toHaveCount(tileApps.length - 2);
  await page.getByText('More apps').click();
  const more = page.getByRole('navigation', { name: 'More apps' }).locator('a.tile');
  await expect(more).toHaveCount(2);
  const hrefs = await page.locator('hh-tiles a.tile').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect([...hrefs].sort()).toEqual(tileApps.map(urlOf).sort());
  for (const link of await more.all()) await expect(link).toBeVisible();
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
