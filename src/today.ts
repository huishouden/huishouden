import { agendaStatus, todayItems, type AgendaItem, type TodayEntry } from '@huishouden/pwa-kit/agenda';
import { addDays, formatTime, startOfDay, toYmd } from '@huishouden/pwa-kit/time';
import type { HouseholdApp } from './apps';
import type { MemberProfile } from './hub';

/** Per app: how many of its things are overdue and how many are coming up this week. */
/** In the household's app order; apps with nothing overdue or coming up this week are left out. */
export function appSummaries(agenda: AgendaItem[], apps: HouseholdApp[], now: number) {
  const weekEnd = addDays(startOfDay(now), 7);
  return apps
    .map((app) => {
      const items = agenda.filter((i) => i.app === app.repo);
      const overdue = items.filter((i) => agendaStatus(i, now) === 'overdue').length;
      const week = items.filter((i) => agendaStatus(i, now) !== 'overdue' && agendaStatus(i, now) !== 'done' && (i.end ?? i.start) >= now && i.start < weekEnd).length;
      return { app, overdue, week };
    })
    .filter((s) => s.overdue + s.week > 0);
}

/**
 * Today's screen: what needs attention (overdue, today, soon), and what is done today, most
 * recently finished first. Done today means due today and done, or marked done today (an overdue
 * job finished this morning, whose own day has passed).
 */
export function todayBoard(agenda: AgendaItem[], now: number): { open: TodayEntry[]; done: TodayEntry[] } {
  const entries = todayItems(agenda, now, { includeDone: true });
  const open = entries.filter((e) => e.group !== 'done');
  const done = entries.filter((e) => e.group === 'done');
  const today = toYmd(now);
  const seen = new Set(done.map((e) => e.item.id));
  for (const item of agenda) {
    if (!seen.has(item.id) && item.status === 'done' && toYmd(item.updatedAt) === today) done.push({ item, group: 'done', when: 'Done' });
  }
  done.sort((a, b) => b.item.updatedAt - a.item.updatedAt);
  return { open, done };
}

/**
 * "Done by Alex at 8:12 AM": who marked it done and when, from the member whose app last wrote it.
 * The time only when that was today; the name from their profile (first name), "you" for `me`.
 */
export function doneLine(item: Pick<AgendaItem, 'by' | 'updatedAt'>, now: number, me: string, profiles: Record<string, MemberProfile>): string {
  const by = item.by === me ? 'you' : profiles[item.by]?.name?.trim().split(/\s+/)[0];
  const at = item.updatedAt > 0 && toYmd(item.updatedAt) === toYmd(now) ? formatTime(item.updatedAt) : undefined;
  return ['Done', by && `by ${by}`, at && `at ${at}`].filter(Boolean).join(' ');
}
