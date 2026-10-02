import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable } from '@huishouden/pwa-kit/e2e';
import { readFileSync } from 'node:fs';
import { member, showHub } from './fixtures/hub';

const registry: { repo: string; site: string; tile?: boolean }[] = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));
const tileApps = registry.filter((app) => app.tile !== false);
const urlOf = (app: { site: string }) => `https://${app.site}.web.app/`;

test('loads without runtime errors and has a working tile for every app in apps.json, in its order', async ({ page }) => {
  await expectCleanLoad(page);
  await expectHuishoudenFrame(page, { app: 'Huishouden', portalUrl: '/' });
  const tiles = page.getByRole('navigation', { name: 'Household apps' }).getByRole('link');
  const links = await tiles.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(links).toEqual(tileApps.map(urlOf));
  await expect(page.getByText('More apps')).toHaveCount(0);
  for (const href of links) expect((await page.request.get(href)).ok(), href).toBe(true);
});

// A household's layout comes from Firestore once a member signs in, which E2E can't do; this hands
// the hub an invented member and layout (window.__hubPreview), the same way the screenshots do.
test('apps a household hides stay reachable under More apps', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const hidden = tileApps.slice(-2).map((a) => a.repo);
  await showHub(page, member({ layout: { order: [], hidden } }));
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Apps' }).click();
  const shown = page.getByRole('navigation', { name: 'Household apps' }).getByRole('link');
  await expect(shown).toHaveCount(tileApps.length - 2);
  await page.getByText('More apps').click();
  const more = page.getByRole('navigation', { name: 'More apps' }).getByRole('link');
  await expect(more).toHaveCount(2);
  for (const link of await more.all()) await expect(link).toBeVisible();
  const hrefs = [...(await shown.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))), ...(await more.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href)))];
  expect(hrefs.sort()).toEqual(tileApps.map(urlOf).sort());
});

test('is installable', ({ page, request }) => expectInstallable(page, request));

test('the introduction offers Google sign-in that reaches Google', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.locator('#household').getByRole('button', { name: 'Sign in with Google' }).click();
  }));

test('the app bar offers Google sign-in that reaches Google', ({ page, context }) =>
  expectGoogleSignInPopup(page, context, async (p) => {
    await p.locator('hh-app-bar').getByRole('button', { name: 'Sign in with Google' }).click();
  }));

test('signed out, the hub explains Huishouden and how to start', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const intro = page.locator('#household');
  await expect(intro.getByRole('heading', { name: 'Simple shared apps for running a home together' })).toBeVisible();
  await expect(intro.getByText("It's free.", { exact: false })).toBeVisible();
  await expect(intro.getByText("A household's information is visible only to its members.")).toBeVisible();
  await expect(intro.getByRole('listitem')).toHaveText([
    'Sign in with your Google account.',
    'Start a household, or join the one you were invited to.',
    'Open any app. Add it to your home screen to keep it close.',
  ]);
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
});

test('the Dutch greeting explains itself', async ({ page }) => {
  await page.clock.setFixedTime('2026-10-01T09:00:00');
  await page.goto('/', { waitUntil: 'networkidle' });
  const word = page.getByRole('button', { name: 'Goedemorgen' });
  await word.click();
  await expect(word).toHaveAttribute('aria-expanded', 'true');
  const card = page.getByRole('note');
  await expect(card).toContainText('Say it: KHOO-duh-mor-khun');
  await expect(card).toContainText('Means: Good morning');
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();
});

test('members land on Today: overdue first, each item linking to its app', async ({ page }) => {
  await page.clock.setFixedTime('2026-10-01T09:00:00');
  await page.goto('/', { waitUntil: 'networkidle' });
  await showHub(page, member());
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  await expect(tabs.getByRole('button')).toHaveText(['Today', 'Calendar', 'Contacts', 'Apps']);
  await expect(tabs.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  const sections = page.locator('main section[aria-label]');
  await expect(sections.first()).toHaveAttribute('aria-label', 'Overdue');
  const gutters = page.getByRole('link', { name: /Gutter cleaning/ });
  await expect(gutters).toContainText('Overdue by 4 days');
  await expect(gutters).toHaveAttribute('href', 'https://huishouden-home.web.app/');
  await expect(page.getByRole('region', { name: 'By app' })).toContainText('Home');
});

test('the calendar lists items by day and filters by app', async ({ page }) => {
  await page.clock.setFixedTime('2026-10-01T09:00:00');
  await page.goto('/calendar', { waitUntil: 'networkidle' });
  await showHub(page, member());
  await expect(page.getByRole('region', { name: 'Tomorrow' })).toContainText('Six-month checkup');
  await page.getByRole('group', { name: 'Show items from' }).getByRole('button', { name: 'Car' }).click();
  await expect(page.getByRole('region', { name: 'Tomorrow' })).not.toContainText('Six-month checkup');
  await expect(page.getByRole('link', { name: /Registration renewal/ })).toHaveAttribute('href', /^https:\/\/huishouden-car\.web\.app\//);
});

test('members get the tabs, and Contacts lists every household contact', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await showHub(page, member());
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  await tabs.getByRole('button', { name: 'Contacts' }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByRole('region', { name: 'Example Plumbing' })).toBeVisible();
  await expect(page.getByLabel('Apps that show State Farm')).toHaveText(/Home\s*Car/);
  await page.getByRole('button', { name: 'Pet', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Example Animal Hospital' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Example Plumbing' })).toHaveCount(0);
});

test("members keep the household's food preferences, with every member listed", async ({ page }) => {
  await page.goto('/apps', { waitUntil: 'networkidle' });
  await showHub(page, member());
  const food = page.getByRole('region', { name: 'Food' });
  await expect(food).toContainText('Meal ideas in Tasks follow these.');
  // Jo is a member with no saved preferences yet: listed anyway, named from the email.
  await expect(food.getByRole('list', { name: 'People' }).getByRole('listitem')).toHaveCount(4);
  await food.getByRole('button', { name: 'Add someone' }).click();
  const dialog = page.getByRole('dialog', { name: 'Someone without an account' });
  await dialog.getByLabel('Name').fill('Kim');
  await dialog.getByRole('button', { name: 'Dairy-free' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(food.getByRole('listitem').filter({ hasText: 'Kim' })).toContainText('Dairy-free');
  await food.getByRole('button', { name: 'Remove butter' }).click();
  await expect(food.getByRole('list', { name: 'Kitchen basics' })).not.toContainText('butter');
});
