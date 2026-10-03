import { expect, test, type Page } from '@playwright/test';
import { helper, member, showHub } from './fixtures/hub';
import { TODO_NOW } from '../src/__fixtures__/todos';

// The To-do tab with an invented household's list (window.__hubPreview): the preview's actions
// change only that state, so these check the screen; the writes themselves are checked by
// @huishouden/pwa-kit/todos' tests, the rules' tests and each app's signed-in staging test.

const open = async (page: Page, state = member()) => {
  await page.clock.setFixedTime(TODO_NOW);
  await page.goto('/todo', { waitUntil: 'networkidle' });
  await showHub(page, state);
};
const list = (page: Page) => page.getByRole('list', { name: 'To-do list' });
const titles = (page: Page) => list(page).getByRole('listitem').evaluateAll((li) => li.map((l) => l.getAttribute('aria-label')));
const row = (page: Page, title: string) => page.getByRole('listitem', { name: title, exact: true });

test('lists every app’s things newest first, sorts by date added either way, due and app', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'To-do' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('8 things to do · 5 added over 30 days ago')).toBeVisible();
  expect((await titles(page)).slice(0, 3)).toEqual(['Put the bins out', 'Return library books', 'Water bill']);
  await expect(row(page, 'Change HVAC filter')).toContainText('Home');
  await expect(row(page, 'Change HVAC filter')).toContainText('Overdue by 4 days');
  await expect(row(page, 'Change HVAC filter')).toContainText('Added 7 months ago');
  await expect(row(page, 'Change HVAC filter').getByRole('link', { name: 'Open Change HVAC filter in Home' })).toHaveAttribute('href', '/home/?job=hvac');
  // The summary line has no actions, only Open.
  await expect(row(page, 'Groceries: 6 on the list').getByRole('button')).toHaveCount(0);

  const sort = page.getByRole('group', { name: 'Sort' });
  await sort.getByRole('button', { name: 'Date added, newest first' }).click();
  expect((await titles(page)).slice(0, 2)).toEqual(['Renew registration', 'Change HVAC filter']);
  await expect(sort.getByRole('button', { name: 'Date added, oldest first' })).toBeVisible();
  await sort.getByRole('button', { name: 'Due', exact: true }).click();
  expect((await titles(page)).slice(0, 3)).toEqual(['Change HVAC filter', 'Put the bins out', 'Heartworm chew']);
  await sort.getByRole('button', { name: 'App', exact: true }).click();
  // The household's app order (here the registry's: Tasks, Groceries, Home, Pet, Car, Bills, …, Baby), newest first within each.
  expect(await titles(page)).toEqual([
    'Return library books', 'Fix the porch light', 'Put the bins out', 'Change HVAC filter', 'Heartworm chew', 'Renew registration', 'Water bill', 'Pack a phone charger',
    'Groceries: 6 on the list',
  ]);
});

test('filters by app and to things added over 30 days ago', async ({ page }) => {
  await open(page);
  const show = page.getByRole('group', { name: 'Show' });
  await show.getByRole('button', { name: 'Home', exact: true }).click();
  expect(await titles(page)).toEqual(['Put the bins out', 'Change HVAC filter']);
  await show.getByRole('button', { name: 'All apps' }).click();
  await show.getByRole('button', { name: 'Older than 30 days (5)' }).click();
  expect(await titles(page)).toEqual(['Fix the porch light', 'Pack a phone charger', 'Heartworm chew', 'Change HVAC filter', 'Renew registration']);
});

test('Done takes an item off with Undo; Cancel asks first, in the app’s words, then offers Undo', async ({ page }) => {
  await open(page);
  await row(page, 'Fix the porch light').locator('[data-todo-action="done"]').click();
  await expect(row(page, 'Fix the porch light')).toHaveCount(0);
  await expect(page.getByText('Done: Fix the porch light')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row(page, 'Fix the porch light')).toBeVisible();

  await page.getByRole('button', { name: 'Pause: Change HVAC filter' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pause “Change HVAC filter”?' });
  await expect(dialog).toContainText("It stays in Home's history, where it can be brought back.");
  await dialog.getByRole('button', { name: 'Keep it' }).click();
  await expect(row(page, 'Change HVAC filter')).toBeVisible();
  await page.getByRole('button', { name: 'Pause: Change HVAC filter' }).click();
  await page.getByRole('dialog').locator('[data-todo-confirm]').click();
  await expect(row(page, 'Change HVAC filter')).toHaveCount(0);
  await expect(page.getByText('Paused: Change HVAC filter')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row(page, 'Change HVAC filter')).toBeVisible();
});

test('clears out old things in one go, with Undo for all of them', async ({ page }) => {
  await open(page);
  await page.getByRole('group', { name: 'Show' }).getByRole('button', { name: /^Older than 30 days/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select Fix the porch light' }).check();
  await page.getByRole('checkbox', { name: 'Select Renew registration' }).check();
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel 2' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel 2 things?' });
  await expect(dialog.getByRole('listitem')).toHaveText(['Fix the porch light', 'Renew registration']);
  await dialog.locator('[data-todo-confirm]').click();
  await expect(page.getByText('Cancelled 2 things.')).toBeVisible();
  expect(await titles(page)).toEqual(['Pack a phone charger', 'Heartworm chew', 'Change HVAC filter']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row(page, 'Fix the porch light')).toBeVisible();
  await expect(row(page, 'Renew registration')).toBeVisible();
});

test('a helper sees no money, ticks things off, and cancels only what they added', async ({ page }) => {
  await open(page, helper());
  await expect(row(page, 'Water bill')).toHaveCount(0);
  await expect(row(page, 'Fix the porch light').locator('[data-todo-action="done"]')).toBeVisible();
  await expect(row(page, 'Fix the porch light').locator('[data-todo-action="cancel"]')).toHaveCount(0);
  await expect(row(page, 'Return library books').locator('[data-todo-action="cancel"]')).toBeVisible();
  await expect(page.getByText('Only admins and members can change or delete what someone else added.')).toBeVisible();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
});

test('on a phone, To-do is in the bottom bar and its actions fit', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const bar = page.locator('nav[data-hh-bottom-nav]');
  await expect(bar.getByRole('button', { name: 'To-do' })).toHaveAttribute('aria-current', 'page');
  // Sort and show are two selects on a phone, so the list starts high on the screen.
  await page.getByRole('combobox', { name: 'Show' }).selectOption('old');
  expect((await titles(page))[0]).toBe('Fix the porch light');
  await page.getByRole('combobox', { name: 'Sort' }).selectOption('due');
  expect((await titles(page))[0]).toBe('Change HVAC filter');
  const porch = row(page, 'Fix the porch light');
  for (const b of await porch.getByRole('button').all()) {
    const box = (await b.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});
