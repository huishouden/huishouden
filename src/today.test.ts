import { describe, expect, it } from 'bun:test';
import type { AgendaItem } from '@huishouden/pwa-kit/agenda';
import fixture from './__fixtures__/agenda.json';
import { APPS } from './apps';
import { appSummaries } from './today';

const local = (s: string) => new Date(s).getTime();
const items = fixture.items.map((i) => ({
  ...i,
  start: local(i.start),
  ...('end' in i && i.end ? { end: local(i.end) } : {}),
  url: `https://huishouden-${i.app}.web.app/`,
  updatedAt: 0,
  by: 'sam@example.com',
})) as AgendaItem[];

describe('per-app summary lines', () => {
  it('counts overdue and this week per app, in the household order, leaving out done, past and unknown apps', () => {
    const lines = appSummaries(items, APPS, local(fixture.now)).map((s) => ({ app: s.app.repo, overdue: s.overdue, week: s.week }));
    expect(lines).toEqual(fixture.expected);
  });
});
