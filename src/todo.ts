import { canDo, olderThan, sortTodos, type TodoItem, type TodoSort } from '@huishouden/pwa-kit/todos';
import type { Role } from '@huishouden/pwa-kit/roles';

/** The To-do tab's choices: how it sorts, which app it shows (null: all), and only old things. */
export interface TodoView {
  sort: TodoSort;
  app: string | null;
  old: boolean;
}

export const DEFAULT_VIEW: TodoView = { sort: 'newest', app: null, old: false };

/** What "Older than" means on the tab. */
export const OLD_DAYS = 30;

/** The items the tab shows for a view, in its order. `appOrder` is the household's tile order. */
export function shownTodos(items: readonly TodoItem[], view: TodoView, appOrder: readonly string[], now: number): TodoItem[] {
  const kept = items.filter((i) => (!view.app || i.app === view.app) && (!view.old || olderThan(i, now, OLD_DAYS)));
  return sortTodos(kept, view.sort, appOrder);
}

/** Apps with something on the list, in the household's order (unknown ones after, by name). */
export function appsWithTodos(items: readonly TodoItem[], appOrder: readonly string[]): string[] {
  const present = [...new Set(items.map((i) => i.app))];
  const rank = (a: string) => (appOrder.includes(a) ? appOrder.indexOf(a) : appOrder.length);
  return present.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const things = (n: number) => `${n} ${n === 1 ? 'thing' : 'things'}`;

/** "12 things to do · 4 added over 30 days ago", or the empty sentence. Summary lines don't count. */
export function summaryLine(items: readonly TodoItem[], now: number): string {
  const open = items.filter((i) => i.status === 'open');
  if (open.length === 0) return 'Nothing to do in any app.';
  const old = open.filter((i) => olderThan(i, now, OLD_DAYS)).length;
  return old ? `${things(open.length)} to do · ${old} added over ${OLD_DAYS} days ago` : `${things(open.length)} to do`;
}

/** The items `me` may cancel: what bulk select offers. */
export function cancellable(items: readonly TodoItem[], role: Role | null | undefined, me: string | undefined): TodoItem[] {
  return items.filter((i) => canDo(i, 'cancel', role, me));
}

const PAST: Record<string, string> = {
  done: 'Done',
  cancel: 'Cancelled',
  pause: 'Paused',
  skip: 'Skipped',
  dismiss: 'Dismissed',
  given: 'Given',
  renewed: 'Renewed',
  'mark paid': 'Marked paid',
  'mark handled': 'Marked handled',
};

/** The toast for an action: "Done: Fix the porch light", "Paused: Change HVAC filter". */
export function actedLine(label: string, title: string): string {
  return `${PAST[label.trim().toLowerCase()] ?? label}: ${title}`;
}

/** The toast for a bulk cancel: "Cancelled 5 things." */
export const bulkLine = (n: number) => `Cancelled ${things(n)}.`;
