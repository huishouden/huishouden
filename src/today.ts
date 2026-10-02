import { agendaStatus, type AgendaItem } from '@huishouden/pwa-kit/agenda';
import { addDays, startOfDay } from '@huishouden/pwa-kit/time';
import type { HouseholdApp } from './apps';

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

