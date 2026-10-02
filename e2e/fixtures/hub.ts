import { expect, type Page } from '@playwright/test';
import type { AgendaItem } from '@huishouden/pwa-kit/agenda';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import type { FoodPreferences } from '@huishouden/pwa-kit/food';
import type { HubState, ReadyHousehold } from '../../src/hub';

// Invented people and places for previews of signed-in screens. E2E can't sign in to Google, so these
// are handed to the app with `window.__hubPreview(state)` (src/data/preview.ts); nothing reaches Firestore.

export const me = 'sam@example.com';
const user = { name: 'Sam Example', email: me, photoURL: null };

export const household: ReadyHousehold = {
  status: 'ready',
  id: 'h1',
  name: "Sam's household",
  members: [me, 'alex@example.com', 'jo@example.com'],
  joined: [me, 'alex@example.com'],
  profiles: { [me]: { name: 'Sam Example' }, 'alex@example.com': { name: 'Alex Example' } },
};

const at = Date.parse('2026-09-01T12:00:00Z');
const contact = (c: Partial<Contact> & Pick<Contact, 'id' | 'name' | 'apps'>): Contact => ({ createdAt: at, by: me, ...c });

export const contacts: Contact[] = [
  contact({ id: 'c1', name: 'Example Animal Hospital', role: 'Vet', phone: '(555) 010-2030', website: 'https://example.com/vet', address: '12 Example Road, Springfield', apps: ['pet'] }),
  contact({ id: 'c2', name: 'Example Pediatrics', role: 'Pediatrician', phone: '(555) 010-4455', email: 'office@example.com', apps: ['baby'] }),
  contact({ id: 'c3', name: 'Jiffy Lube', role: 'Mechanic', phone: '(555) 010-7788', address: '400 Main Street, Springfield', notes: 'Oil change every 5,000 miles.', apps: ['car'] }),
  contact({ id: 'c4', name: 'Terminix', role: 'Pest control', phone: '(555) 010-9911', website: 'https://example.com/pest', apps: ['home'] }),
  contact({ id: 'c5', name: 'Example Plumbing', role: 'Plumber', phone: '(555) 010-3344', apps: [] }),
  contact({ id: 'c6', name: 'State Farm', role: 'Insurance', phone: '(555) 010-6677', notes: 'Policy covers both cars and the house.', apps: ['home', 'car'] }),
];

// Local times, like the apps publish them; the screenshots freeze the clock at 9:00 on October 1.
const local = (s: string) => new Date(s).getTime();
const item = (i: Omit<AgendaItem, 'updatedAt' | 'by' | 'url' | 'allDay'> & Partial<Pick<AgendaItem, 'updatedAt' | 'by' | 'allDay'>> & { path?: string }): AgendaItem => ({
  allDay: false,
  url: `https://huishouden-${i.app}.web.app/${i.path ?? ''}`,
  updatedAt: at,
  by: me,
  ...i,
});

export const agenda: AgendaItem[] = [
  item({ id: 'a1', app: 'home', ref: 'job:gutters', kind: 'due', title: 'Gutter cleaning', start: local('2026-09-27T00:00'), allDay: true, status: 'upcoming' }),
  item({ id: 'a2', app: 'bills', ref: 'bill:water', kind: 'bill', title: 'Water bill', detail: '$48.20', start: local('2026-10-01T00:00'), allDay: true, status: 'upcoming' }),
  item({ id: 'a3', app: 'pet', ref: 'appt:checkup', kind: 'appointment', title: 'Yearly checkup', who: 'Biscuit', detail: 'Example Animal Hospital', start: local('2026-10-01T15:30'), end: local('2026-10-01T16:15') }),
  item({ id: 'a4', app: 'pet', ref: 'med:heartworm', kind: 'medicine', title: 'Heartworm chew', who: 'Biscuit', start: local('2026-10-01T19:00'), status: 'upcoming' }),
  item({ id: 'a5', app: 'baby', ref: 'appt:6m', kind: 'appointment', title: 'Six-month checkup', detail: 'Example Pediatrics', start: local('2026-10-02T10:00'), end: local('2026-10-02T10:30') }),
  item({ id: 'a6', app: 'car', ref: 'job:oil', kind: 'due', title: 'Oil change', who: 'Hatchback', detail: 'Jiffy Lube', start: local('2026-10-02T00:00'), allDay: true, status: 'upcoming' }),
  item({ id: 'a7', app: 'bills', ref: 'bill:netflix', kind: 'bill', title: 'Netflix', detail: 'Autopay on', start: local('2026-10-06T00:00'), allDay: true, status: 'upcoming' }),
  item({ id: 'a8', app: 'car', ref: 'renewal:registration', kind: 'renewal', title: 'Registration renewal', who: 'Hatchback', start: local('2026-10-14T00:00'), allDay: true, status: 'upcoming' }),
  item({ id: 'a9', app: 'home', ref: 'job:hvac', kind: 'due', title: 'HVAC filter', start: local('2026-10-20T00:00'), allDay: true, status: 'upcoming' }),
  item({ id: 'a10', app: 'home', ref: 'appt:pest', kind: 'appointment', title: 'Terminix visit', start: local('2026-10-08T13:00'), end: local('2026-10-08T14:00') }),
  // Done this morning: they show folded away under "Done today", with who and when.
  item({ id: 'd1', app: 'pet', ref: 'feed:breakfast', kind: 'feeding', title: "Biscuit's breakfast", who: 'Biscuit', detail: '1 cup dry food', start: local('2026-10-01T07:00'), status: 'done', updatedAt: local('2026-10-01T07:05'), by: 'alex@example.com' }),
  item({ id: 'd2', app: 'tasks', ref: 'task:recycling', kind: 'task', title: 'Take out the recycling', start: local('2026-10-01T00:00'), allDay: true, status: 'done', updatedAt: local('2026-10-01T08:15') }),
  // An ongoing course: on the calendar, not on Today.
  item({ id: 'm1', app: 'pet', ref: 'med:course', kind: 'medicine', title: 'Antibiotic course', who: 'Biscuit', start: local('2026-09-28T00:00'), end: local('2026-10-05T00:00'), allDay: true }),
];

/** The agenda after an app marks `id` done just now. */
export const markedDone = (id: string, by = me): AgendaItem[] =>
  agenda.map((i) => (i.id === id ? { ...i, status: 'done', updatedAt: local('2026-10-01T09:00'), by } : i));

export const food: FoodPreferences = {
  people: [
    { id: me, name: 'Sam', member: me, diets: ['gerd'], avoid: ['cilantro'], spice: 'mild' },
    { id: 'alex@example.com', name: 'Alex', member: 'alex@example.com', diets: ['vegetarian', 'pregnant'], avoid: [], spice: 'hot' },
    { id: 'kid-1', name: 'Robin', diets: ['nut allergy'], avoid: ['mushrooms'], note: 'Small portions' },
  ],
  pantryAssumed: ['salt', 'black pepper', 'common dried herbs and spices', 'cooking oil', 'cooking spray', 'butter'],
  updatedAt: at,
  by: me,
};

export const member = (extra: Partial<Extract<HubState, { auth: 'signed-in' }>> = {}): HubState => ({
  auth: 'signed-in',
  user,
  me,
  household,
  contacts,
  agenda,
  food,
  ...extra,
});

/** A device that remembers a member, while sign-in restores. */
export const restoring: HubState = { auth: 'starting', remembered: true };

export const noHousehold: HubState = { auth: 'signed-in', user, me, household: { status: 'none', suggestedName: "Sam's household" } };

/** Waits for sign-in to resolve as signed out (so it can't replace the preview), then shows `state`. */
export async function showHub(page: Page, state: HubState) {
  await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible();
  await page.evaluate((s) => window.__hubPreview!(s), state);
}
