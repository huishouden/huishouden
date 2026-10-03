import type { TodoAction, TodoItem } from '@huishouden/pwa-kit/todos';
import type { Role } from '@huishouden/pwa-kit/roles';

// An invented household's to-do list, as the apps would publish it: one or two items per app, some
// added long ago, one summary line. The clock in tests and screenshots is 9:00 on October 1, 2026.
export const TODO_NOW = '2026-10-01T09:00:00';

const SAM = 'sam@example.com';
const ALEX = 'alex@example.com';
const JO = 'jo@example.com';
const EVERYONE: Role[] = ['admin', 'member', 'helper', 'kid'];
const STAFF: Role[] = ['admin', 'member'];
const t = (s: string) => new Date(s).getTime();
const site = 'https://huishouden-piekstra.web.app';

const act = (label: string, roles: Role[], col: string, id: string, data: object, owner = false): TodoAction => ({
  label,
  roles,
  ops: [{ col, id, data, merge: true }],
  ...(owner ? { owner: true } : {}),
});

const todo = (i: Omit<TodoItem, 'id' | 'updatedAt' | 'by' | 'status' | 'url'> & { path: string; status?: TodoItem['status'] }): TodoItem => {
  const { path, ...rest } = i;
  return { id: `${i.app}:${i.ref}`, status: 'open', url: `${site}/${i.app}/${path}`, updatedAt: t('2026-10-01T08:00'), by: SAM, ...rest };
};

export const todos: TodoItem[] = [
  todo({
    app: 'tasks', ref: 'item:porch', title: 'Fix the porch light', detail: 'Chores & Notes', createdAt: t('2026-08-10T18:20'), owner: ALEX, path: '?list=chores&item=porch',
    done: act('Done', EVERYONE, 'items', 'porch', { completed: true, completedAt: '$now', updatedAt: '$now' }),
    cancel: act('Cancel', STAFF, 'items', 'porch', { completed: true, completedAt: '$now', cancelledAt: '$now', cancelledBy: '$me', updatedAt: '$now' }, true),
  }),
  todo({
    app: 'tasks', ref: 'item:library', title: 'Return library books', detail: 'Chores & Notes', createdAt: t('2026-09-28T16:00'), due: t('2026-10-02T00:00'), owner: JO, path: '?list=chores&item=library',
    done: act('Done', EVERYONE, 'items', 'library', { completed: true, completedAt: '$now', updatedAt: '$now' }),
    cancel: act('Cancel', STAFF, 'items', 'library', { completed: true, completedAt: '$now', cancelledAt: '$now', cancelledBy: '$me', updatedAt: '$now' }, true),
  }),
  todo({
    app: 'home', ref: 'job:hvac', title: 'Change HVAC filter', detail: 'Heating and cooling', createdAt: t('2026-03-02T10:00'), due: t('2026-09-27T00:00'), owner: SAM, path: '?job=hvac',
    done: act('Done', EVERYONE, 'homeTasks', 'hvac', { lastDone: '$today', due: '$today+3m', updatedAt: '$now' }),
    cancel: act('Pause', STAFF, 'homeTasks', 'hvac', { pausedAt: '$now', updatedAt: '$now' }, true),
  }),
  todo({
    app: 'home', ref: 'prep:bins_2026-10-02', title: 'Put the bins out', detail: 'Garbage pickup tomorrow', createdAt: t('2026-09-30T19:00'), due: t('2026-10-01T00:00'), owner: SAM, path: '?event=bins',
    done: { label: 'Done', roles: EVERYONE, ops: [{ col: 'homeEventPrep', id: 'bins_2026-10-02', data: { done: true, at: '$now', by: '$me' } }] },
    cancel: { label: 'Skip', roles: EVERYONE, ops: [{ col: 'homeEventPrep', id: 'bins_2026-10-02', data: { done: true, skipped: true, at: '$now', by: '$me' } }] },
  }),
  todo({
    app: 'baby', ref: 'check:charger', title: 'Pack a phone charger', detail: 'Hospital bag', createdAt: t('2026-07-15T12:00'), owner: ALEX, path: '?tab=checklists',
    done: act('Done', EVERYONE, 'babyChecklists', 'charger', { done: true }),
    cancel: act('Skip', STAFF, 'babyChecklists', 'charger', { skipped: true, skippedAt: '$now' }, true),
  }),
  todo({
    app: 'pet', ref: 'reminder:heartworm', title: 'Heartworm chew', who: 'Biscuit', createdAt: t('2026-05-01T09:00'), due: t('2026-10-01T00:00'), owner: SAM, path: 'pets/biscuit',
    done: act('Given', ['admin', 'member', 'helper'], 'petReminders', 'heartworm', { lastDoneAt: '$now', due: '$today+1m', updatedAt: '$now' }),
    cancel: act('Dismiss', STAFF, 'petReminders', 'heartworm', { dismissedAt: '$now', updatedAt: '$now' }, true),
  }),
  todo({
    app: 'car', ref: 'renewal:registration', title: 'Renew registration', who: 'Hatchback', createdAt: t('2025-11-20T12:00'), due: t('2026-10-14T00:00'), owner: SAM, path: '?renewal=registration',
    done: act('Renewed', EVERYONE, 'carRenewals', 'registration', { dueDate: '2027-10-14', updatedAt: '$now' }),
    cancel: act('Mark handled', STAFF, 'carRenewals', 'registration', { closedAt: '$now', updatedAt: '$now' }, true),
  }),
  todo({
    app: 'bills', ref: 'bill:water', title: 'Water bill', detail: '$48.20', createdAt: t('2026-09-20T07:30'), due: t('2026-10-05T00:00'), private: true, path: '?bill=water',
    done: act('Mark paid', STAFF, 'bills', 'water', { status: 'paid', paidAt: '$now', paidBy: '$me', paidVia: 'member', updatedAt: '$now' }),
    cancel: act('Skip', STAFF, 'bills', 'water', { dismissed: true, updatedAt: '$now' }),
  }),
  todo({ app: 'groceries', ref: 'list', title: 'Groceries: 6 on the list', createdAt: t('2026-09-25T17:00'), path: '', status: 'info' }),
];

/** What a helper's portal reads: nothing private, nothing about money. */
export const helperTodos = (): TodoItem[] => todos.filter((i) => !i.private && i.app !== 'bills');
