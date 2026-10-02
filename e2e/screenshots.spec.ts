import { expect, test, type Page } from '@playwright/test';
import { captureScreenshot } from '@huishouden/pwa-kit/e2e';
import type { HubState } from '../src/hub';
import { helper, me, member, noHousehold, restoring, showHub } from './fixtures/hub';

// README images, refreshed by CI after each deploy (only committed when they change). Signed-in
// screens show invented data handed to the app (window.__hubPreview); nothing reaches Firestore.
const fixedTime = '2026-10-01T09:00:00';
const phone = (page: Page) => page.setViewportSize({ width: 390, height: 844 });
const tab = (p: Page, name: string) => p.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name }).click();
const preview = (state: HubState, then?: (p: Page) => Promise<void>) => async (p: Page) => {
  await showHub(p, state);
  await then?.(p);
};
/** A member's Apps tab (members land on Today). */
const onApps = (state: HubState, then?: (p: Page) => Promise<void>) =>
  preview(state, async (p) => {
    await tab(p, 'Apps');
    await then?.(p);
  });

test('home', ({ page }) => captureScreenshot(page, 'home', { fixedTime }));

test('phone: home', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-home', { fixedTime });
});

test('phone: getting started', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-getting-started', {
    fixedTime,
    prepare: (p) => p.getByRole('heading', { name: 'How it works' }).scrollIntoViewIfNeeded(),
  });
});

test('dutch word', ({ page }) =>
  captureScreenshot(page, 'dutch-word', {
    fixedTime,
    prepare: async (p) => {
      await p.getByRole('button', { name: 'Goedemorgen' }).click();
      await expect(p.getByText('Means: Good morning')).toBeVisible();
    },
  }));

test('account menu', ({ page }) =>
  captureScreenshot(page, 'account-menu', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await p.getByRole('button', { name: `Signed in as ${me}` }).click();
      await expect(p.getByText(me, { exact: true }).first()).toBeVisible();
    }),
  }));

test('apps', ({ page }) =>
  captureScreenshot(page, 'apps', {
    fixedTime,
    prepare: onApps(member(), (p) => expect(p.getByRole('heading', { name: "Sam's household" })).toBeVisible()),
  }));

test('no household yet', ({ page }) =>
  captureScreenshot(page, 'household-none', {
    fixedTime,
    prepare: preview(noHousehold, async (p) => {
      await expect(p.getByRole('button', { name: 'Start a household' })).toBeVisible();
      await expect(p.getByText(`Waiting for an invite? Ask a member to invite ${me}.`)).toBeVisible();
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

test('naming a new household', ({ page }) =>
  captureScreenshot(page, 'household-start', {
    fixedTime,
    prepare: preview(noHousehold, async (p) => {
      await p.getByRole('button', { name: 'Start a household' }).click();
      const name = p.getByLabel('Name', { exact: true });
      await expect(name).toHaveValue("Sam's household");
      await expect(name).toBeFocused();
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

test('a household just started', ({ page }) =>
  captureScreenshot(page, 'household-new', {
    fixedTime,
    prepare: preview(noHousehold, async (p) => {
      await p.getByRole('button', { name: 'Start a household' }).click();
      await p.getByRole('button', { name: 'Start', exact: true }).click();
      await expect(p.getByText("Invite the people you live with. They'll get every app when they sign in.")).toBeVisible();
      await expect(p.getByPlaceholder('Their Google account email')).toBeFocused();
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

test('renaming the household', ({ page }) =>
  captureScreenshot(page, 'household-rename', {
    fixedTime,
    prepare: onApps(member(), async (p) => {
      await p.getByRole('button', { name: 'Rename' }).click();
      const name = p.getByLabel('Household name');
      await expect(name).toHaveValue("Sam's household");
      await name.fill('The Example house');
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

test('inviting someone', ({ page }) =>
  captureScreenshot(page, 'household-invited', {
    fixedTime,
    prepare: onApps(member(), async (p) => {
      await p.getByPlaceholder('Their Google account email').fill('robin@example.com');
      await p.getByRole('button', { name: 'Invite', exact: true }).click();
      await expect(p.getByText('robin@example.com is invited. Let them know by email:')).toBeVisible();
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

// Roles: an admin sets them per member; a helper sees no money and changes no settings.
test('household roles', ({ page }) =>
  captureScreenshot(page, 'household-roles', {
    fixedTime,
    prepare: onApps(member(), async (p) => {
      await p.getByText('What each role can do').click();
      await expect(p.getByLabel('Role for jo@example.com')).toHaveValue('helper');
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

test('a helper’s apps', ({ page }) =>
  captureScreenshot(page, 'helper-apps', {
    fixedTime,
    prepare: onApps(helper(), async (p) => {
      await expect(p.getByText('Only admins can invite or remove people and set roles.')).toBeVisible();
    }),
  }));

test('a helper’s household and food', ({ page }) =>
  captureScreenshot(page, 'helper-household', {
    fixedTime,
    prepare: onApps(helper(), async (p) => {
      await p.locator('#household').scrollIntoViewIfNeeded();
    }),
  }));

test('a private contact', ({ page }) =>
  captureScreenshot(page, 'contact-private', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Contacts');
      await p.getByRole('button', { name: 'Edit Example Pediatrics' }).click();
      await p.getByText('Only admins and members').click();
    }),
  }));

test('arranging the apps', ({ page }) =>
  captureScreenshot(page, 'tiles-arrange', {
    fixedTime,
    prepare: onApps(member({ layout: { order: ['tasks', 'pet', 'home', 'car', 'bills', 'spending', 'baby'], hidden: ['baby'] } }), async (p) => {
      await p.getByRole('button', { name: 'Arrange' }).click();
      await p.getByRole('button', { name: 'Move Home earlier' }).focus();
    }),
  }));

test('a household with hidden apps', ({ page }) =>
  captureScreenshot(page, 'tiles-hidden', {
    fixedTime,
    prepare: onApps(member({ layout: { order: [], hidden: ['spending', 'baby'] } }), async (p) => {
      await p.getByText('More apps').click();
      await expect(p.getByRole('navigation', { name: 'More apps' }).getByRole('link')).toHaveCount(2);
    }),
  }));

test('phone: arranging the apps', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-tiles-arrange', {
    fixedTime,
    prepare: onApps(member({ layout: { order: [], hidden: ['baby'] } }), async (p) => {
      await p.getByRole('button', { name: 'Arrange' }).click();
    }),
  });
});

test('today', ({ page }) =>
  captureScreenshot(page, 'today', {
    fixedTime,
    prepare: preview(member(), (p) => expect(p.getByRole('link', { name: /Gutter cleaning/ })).toContainText('Overdue by 4 days')),
  }));

test('phone: today', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-today', {
    fixedTime,
    prepare: preview(member(), (p) => expect(p.getByRole('link', { name: /Gutter cleaning/ })).toBeVisible()),
  });
});

test('today: done items', ({ page }) =>
  captureScreenshot(page, 'today-done', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await p.getByText('Done today (2)').click();
      await p.getByRole('list', { name: 'Done today' }).scrollIntoViewIfNeeded();
    }),
  }));

test('phone: today while sign-in restores', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-today-restoring', {
    fixedTime,
    prepare: preview(restoring, (p) => expect(p.getByText("Loading the household's day.")).toBeAttached()),
  });
});

test('calendar', ({ page }) =>
  captureScreenshot(page, 'calendar', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Calendar');
      await expect(p.getByRole('region', { name: 'Tomorrow' })).toBeVisible();
    }),
  }));

test('phone: calendar', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-calendar', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Calendar');
      await expect(p.getByRole('region', { name: 'Tomorrow' })).toBeVisible();
    }),
  });
});

test('food', ({ page }) =>
  captureScreenshot(page, 'food', {
    fixedTime,
    prepare: onApps(member(), async (p) => {
      await p.getByRole('region', { name: 'Food' }).scrollIntoViewIfNeeded();
      await expect(p.getByText('Jo', { exact: true })).toBeVisible();
    }),
  }));

test('food person', ({ page }) =>
  captureScreenshot(page, 'food-person', {
    fixedTime,
    prepare: onApps(member(), async (p) => {
      await p.getByRole('button', { name: "Edit Alex's food" }).click();
      await expect(p.getByRole('dialog', { name: "Alex's food" })).toBeVisible();
    }),
  }));

test('contacts', ({ page }) =>
  captureScreenshot(page, 'contacts', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Contacts');
      await expect(p.getByRole('region', { name: 'Jiffy Lube' })).toBeVisible();
    }),
  }));

test('contact apps', ({ page }) =>
  captureScreenshot(page, 'contact-apps', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Contacts');
      await p.getByRole('button', { name: 'Choose apps for Example Plumbing' }).click();
      await expect(p.getByRole('dialog', { name: 'Show Example Plumbing in' })).toBeVisible();
    }),
  }));

test('new contact', ({ page }) =>
  captureScreenshot(page, 'contact-new', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Contacts');
      await p.getByRole('button', { name: 'Add contact' }).click();
      await expect(p.getByRole('dialog', { name: 'New contact' })).toBeVisible();
    }),
  }));

test('phone: contacts', async ({ page }) => {
  await phone(page);
  await captureScreenshot(page, 'phone-contacts', {
    fixedTime,
    prepare: preview(member(), async (p) => {
      await tab(p, 'Contacts');
      await expect(p.getByRole('region', { name: 'Example Animal Hospital' })).toBeVisible();
    }),
  });
});

