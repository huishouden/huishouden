import { expect, test, type Page } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';
import type { PanelView } from '../src/household-view';

// README images, refreshed by CI after each deploy (only committed when they change).
const fixedTime = '2026-10-01T09:00:00';

test('home', ({ page }) => captureScreenshot(page, 'home', { fixedTime }));

test('phone: home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-home', { fixedTime });
});

test('phone: getting started', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureScreenshot(page, 'phone-getting-started', {
    fixedTime,
    prepare: (p) => p.getByRole('heading', { name: 'How it works' }).scrollIntoViewIfNeeded(),
  });
});

// The app bar with an invented signed-in person and the account menu open.
test('account menu', ({ page }) =>
  captureScreenshot(page, 'account-menu', {
    fixedTime,
    prepare: async (p) => {
      await signInAs(p);
      await p.getByRole('button', { name: 'Signed in as sam@example.com' }).click();
      await expect(p.getByText('sam@example.com', { exact: true })).toBeVisible();
    },
  }));

// Signed-in household panel states. E2E can't sign in to Google, so these give the panel's view
// invented data directly (`<hh-household>.view`); nothing here reaches Firestore.
const me = 'sam@example.com';

async function signInAs(p: Page) {
  await p.locator('hh-app-bar').evaluate((bar: HTMLElementTagNameMap['hh-app-bar']) => {
    bar.user = { name: 'Sam Example', email: 'sam@example.com', photoURL: null };
  });
}

async function showPanel(p: Page, view: PanelView) {
  // Wait for sign-in to resolve as signed out, so it can't replace the view set below.
  await expect(p.locator('#household').getByRole('heading', { name: 'How it works' })).toBeVisible();
  await signInAs(p);
  await p.locator('hh-household').evaluate((el: HTMLElementTagNameMap['hh-household'], v) => (el.view = v), view);
  await p.locator('hh-household').scrollIntoViewIfNeeded();
}

test('no household yet', ({ page }) =>
  captureScreenshot(page, 'household-none', {
    fixedTime,
    prepare: async (p) => {
      await showPanel(p, { status: 'none', me, suggestedName: "Sam's household" });
      await expect(p.getByRole('button', { name: 'Start a household' })).toBeVisible();
      await expect(p.getByText(`Waiting for an invite? Ask a member to invite ${me}.`)).toBeVisible();
    },
  }));

test('naming a new household', ({ page }) =>
  captureScreenshot(page, 'household-start', {
    fixedTime,
    prepare: async (p) => {
      await showPanel(p, { status: 'none', me, suggestedName: "Sam's household" });
      await p.getByRole('button', { name: 'Start a household' }).click();
      const name = p.getByLabel('Name', { exact: true });
      await expect(name).toHaveValue("Sam's household");
      await expect(name).toBeFocused();
    },
  }));

test('a household just started', ({ page }) =>
  captureScreenshot(page, 'household-new', {
    fixedTime,
    prepare: async (p) => {
      await showPanel(p, {
        status: 'ready',
        me,
        household: { id: 'h1', name: "Sam's household", members: [me], joined: [me] },
        profiles: { [me]: { name: 'Sam Example' } },
        focusInvite: true,
      });
      await expect(p.getByText("Invite the people you live with. They'll get every app when they sign in.")).toBeVisible();
      await expect(p.getByPlaceholder('Their Google account email')).toBeFocused();
    },
  }));

test('renaming the household', ({ page }) =>
  captureScreenshot(page, 'household-rename', {
    fixedTime,
    prepare: async (p) => {
      await showPanel(p, {
        status: 'ready',
        me,
        household: { id: 'h1', name: "Sam's household", members: [me, 'alex@example.com', 'jo@example.com'], joined: [me, 'alex@example.com'] },
        profiles: { [me]: { name: 'Sam Example' }, 'alex@example.com': { name: 'Alex Example' } },
      });
      await p.getByRole('button', { name: 'Rename' }).click();
      const name = p.getByLabel('Household name');
      await expect(name).toHaveValue("Sam's household");
      await name.fill('The Example house');
    },
  }));
