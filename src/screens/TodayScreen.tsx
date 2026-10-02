import { todayItems, type AgendaItem, type TodayEntry, type TodayGroup } from '@huishouden/pwa-kit/agenda';
import { longDate, toYmd } from '@huishouden/pwa-kit/time';
import { cardClass, overline } from '@huishouden/pwa-kit/react/ui';
import type { HouseholdApp } from '../apps';
import { AppIcon } from '../components/AppIcon';
import { Greeting } from '../components/DutchWord';
import { appSummaries } from '../today';

interface Props {
  agenda: AgendaItem[] | undefined;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  now: number;
}

const HEADINGS: Record<TodayGroup, string> = { overdue: 'Overdue', today: 'Today', soon: 'Next two days' };

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The wall-tablet glance: what is overdue, what is on today and in the next two days across every
 * app, big enough to read across the room, each a tap away from its app; and one line per app.
 */
export function TodayScreen({ agenda, apps, now }: Props) {
  const today = toYmd(now);
  const byRepo = new Map(apps.map((a) => [a.repo, a]));
  const entries = agenda ? todayItems(agenda, now) : [];
  const groups = (['overdue', 'today', 'soon'] as TodayGroup[])
    .map((g) => ({ group: g, entries: entries.filter((e) => e.group === g) }))
    .filter((g) => g.entries.length > 0);
  const summaries = agenda ? appSummaries(agenda, apps, now) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <Greeting hour={new Date(now).getHours()} />
        <p className="text-lg text-stone-600">{longDate(today, today)}</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6" aria-live="polite">
          {agenda === undefined && <p className="text-lg text-stone-600">Loading the household's day.</p>}
          {agenda !== undefined && groups.length === 0 && (
            <p className={`${cardClass} p-6 text-xl text-stone-600`}>Nothing due today or in the next two days.</p>
          )}
          {groups.map(({ group, entries }) => (
            <section key={group} aria-label={HEADINGS[group]}>
              <h2 className={`mb-2 ${overline} ${group === 'overdue' ? 'text-terracotta-dark' : ''}`}>{HEADINGS[group]}</h2>
              <ul className={`${cardClass} divide-y divide-stone-200`}>
                {entries.map((e) => (
                  <TodayRow key={e.item.id} entry={e} app={byRepo.get(e.item.app)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {summaries.length > 0 && (
          <section aria-label="By app" className={`${cardClass} p-5`}>
            <h2 className={`mb-2 ${overline}`}>By app</h2>
            <ul className="divide-y divide-stone-200">
              {summaries.map(({ app, overdue, week }) => (
                <li key={app.repo}>
                  <a href={app.url} className="flex min-h-14 items-center gap-3 py-2 hover:text-forest-700">
                    <AppIcon app={app} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{app.name}</span>
                      <span className="block text-stone-600">
                        {overdue > 0 && <span className="font-medium text-terracotta-dark">{count(overdue, 'overdue', 'overdue')}</span>}
                        {overdue > 0 && week > 0 && ' · '}
                        {week > 0 && `${count(week, 'thing', 'things')} this week`}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function TodayRow({ entry: { item, group, when }, app }: { entry: TodayEntry; app?: HouseholdApp }) {
  const meta = [item.who, item.detail].filter(Boolean).join(' · ');
  return (
    <li>
      <a href={item.url} className="flex min-h-20 items-center gap-4 px-4 py-4 hover:bg-forest-50 sm:px-5">
        {app && <AppIcon app={app} size={44} />}
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-semibold text-stone-800 [overflow-wrap:break-word] sm:text-2xl">{item.title}</span>
          <span className={`block text-lg font-medium tabular-nums sm:hidden ${group === 'overdue' ? 'text-terracotta-dark' : 'text-stone-700'}`}>{when}</span>
          {meta && <span className="block text-base text-stone-600 [overflow-wrap:break-word] sm:text-lg">{meta}</span>}
        </span>
        <span className={`hidden shrink-0 text-right text-xl font-medium tabular-nums sm:block ${group === 'overdue' ? 'text-terracotta-dark' : 'text-stone-700'}`}>{when}</span>
        <span className="sr-only">Open in {app?.name ?? 'its app'}</span>
      </a>
    </li>
  );
}
