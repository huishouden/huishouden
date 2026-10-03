import { expect, test } from '@playwright/test';
import { expectCleanLoad, expectGoogleSignInPopup, expectHuishoudenFrame, expectInstallable, expectSecurityHeaders } from '@huishouden/pwa-kit/e2e';
import { readFileSync } from 'node:fs';
import { MEMBER_HINT } from '../src/memberHint';
import { markedDone, member, restoring, showHub } from './fixtures/hub';

type RegistryEntry = { repo: string; site: string; path?: string; redirect?: boolean; tile?: boolean };
const registry: RegistryEntry[] = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));
const tileApps = registry.filter((app) => app.tile !== false);
// Tiles open a moved app at its path on this site (resolved against the page), others at their own site.
const BASE = process.env.BASE_URL ?? 'https://huishouden-piekstra.web.app/';
// (Same rule as appHref in src/apps.ts, which Playwright can't import: it imports apps.json.)
const appHref = (app: RegistryEntry) => (app.path && app.redirect ? app.path : `https://${app.site}.web.app/`);
const urlOf = (app: RegistryEntry) => new URL(appHref(app), BASE).href;

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
  const home = registry.find((a) => a.repo === 'home')!;
  await expect(gutters).toHaveAttribute('href', home.redirect ? home.path! : 'https://huishouden-home.web.app/');
  await expect(page.getByRole('region', { name: 'By app' })).toContainText('Home');
  // The kind is the icon, the app its badge; both read out. A title naming who leaves `who` out.
  await expect(gutters).toContainText('Due. Open in Home');
  await expect(page.getByRole('link', { name: /Yearly checkup/ })).toContainText('Biscuit · Example Animal Hospital');
  // An ongoing course is calendar context, not something to do today.
  await expect(page.getByRole('link', { name: /Antibiotic course/ })).toHaveCount(0);
});

test("today's done items fold away at the bottom, and items flip there when an app marks them done", async ({ page }) => {
  await page.clock.setFixedTime('2026-10-01T09:00:00');
  await page.goto('/', { waitUntil: 'networkidle' });
  await showHub(page, member());
  const summary = page.getByText(/^Done today \(\d+\)$/);
  await expect(summary).toHaveText('Done today (2)');
  const done = page.getByRole('list', { name: 'Done today' });
  await expect(done).toBeHidden();
  await summary.click();
  await expect(done.getByRole('listitem')).toHaveText([/Take out the recycling.*Done by you at 8:15/, /Biscuit's breakfast1 cup dry food · Done by Alex at 7:05/]);
  await expect(done.getByText('Take out the recycling')).toHaveCSS('text-decoration-line', 'line-through');
  // The live agenda updates within seconds of an app's write; the preview stands in for it.
  await page.evaluate((s) => window.__hubPreview!(s), member({ agenda: markedDone('a2', 'alex@example.com') }));
  await expect(page.getByText('Done today (3)')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Today' })).not.toContainText('Water bill');
  await expect(done.getByRole('listitem').first()).toContainText('Water bill');
});

test('a device that remembers a member lays out Today while sign-in restores, and falls back when the session is gone', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, JSON.stringify({ household: 'h1' })), MEMBER_HINT);
  await page.goto('/');
  // No session in a test browser: the hint is dropped and the introduction shows.
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sections' })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), MEMBER_HINT)).toBeNull();
  await page.evaluate((s) => window.__hubPreview!(s), restoring);
  const tabs = page.getByRole('navigation', { name: 'Sections' });
  await expect(tabs.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText("Loading the household's day.")).toBeAttached();
  await expect(page.locator('#household')).toHaveCount(0);
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
  await expect(food).toContainText('Meal ideas keep to the lowest heat anyone picked.');
  const sam = food.getByRole('group', { name: "Sam's spice" });
  await expect(sam.getByRole('button', { name: 'A little' })).toHaveAttribute('aria-pressed', 'true');
  const robin = food.getByRole('group', { name: "Robin's spice" });
  await expect(robin.getByRole('button', { pressed: true })).toHaveCount(0);
  await robin.getByRole('button', { name: 'No heat' }).click();
  await expect(robin.getByRole('button', { name: 'No heat' })).toHaveAttribute('aria-pressed', 'true');
  await robin.getByRole('button', { name: 'No heat' }).click();
  await expect(robin.getByRole('button', { pressed: true })).toHaveCount(0);
  await expect(food.getByRole('list', { name: 'Kitchen basics' })).not.toContainText('butter');
});

// Contacts reads place screenshots, so the camera is allowed; location and microphone are not.
test('sends the security headers and leaves sign-in un-framed', ({ request }) => expectSecurityHeaders(request, '/', { camera: true }));
