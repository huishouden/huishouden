import { useState } from 'react';
import { agendaDays, agendaStatus, agendaTime, type AgendaItem } from '@huishouden/pwa-kit/agenda';
import { dueText, toYmd } from '@huishouden/pwa-kit/time';
import { Chip, cardClass, overline } from '@huishouden/pwa-kit/react/ui';
import type { HouseholdApp } from '../apps';
import { ItemIcon, KIND_WORDS, itemMeta } from '../components/ItemIcon';

interface Props {
  agenda: AgendaItem[] | undefined;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  now: number;
}

/** Every app's dated things by day, from today on, with overdue ones first; each opens its app. */
export function CalendarScreen({ agenda, apps, now }: Props) {
  const [only, setOnly] = useState<string | null>(null);
  const today = toYmd(now);
  const byRepo = new Map(apps.map((a) => [a.repo, a]));
  const items = agenda ?? [];
  const withItems = apps.filter((a) => items.some((i) => i.app === a.repo));
  const shown = only ? items.filter((i) => i.app === only) : items;
  const overdue = shown.filter((i) => agendaStatus(i, now) === 'overdue');
  const days = agendaDays(
    shown.filter((i) => agendaStatus(i, now) !== 'overdue'),
    now,
    { from: today },
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-stone-800">Calendar</h2>
      {withItems.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show items from">
          <Chip active={only === null} onClick={() => setOnly(null)}>
            All apps
          </Chip>
          {withItems.map((a) => (
            <Chip key={a.repo} active={only === a.repo} onClick={() => setOnly(a.repo)}>
              {a.name}
            </Chip>
          ))}
        </div>
      )}
      {agenda === undefined && <p className="text-lg text-stone-600">Loading the calendar.</p>}
      {agenda !== undefined && overdue.length === 0 && days.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-stone-600`}>
          Nothing coming up. Appointments, due jobs, bills and renewals from the household's apps show here.
        </p>
      )}
      {overdue.length > 0 && (
        <Day label="Overdue" attention>
          {overdue.map((i) => (
            <Row key={i.id} item={i} app={byRepo.get(i.app)} when={i.allDay || toYmd(i.start) < today ? dueText(toYmd(i.start), today) : agendaTime(i)} attention />
          ))}
        </Day>
      )}
      {days.map((d) => (
        <Day key={d.day} label={d.label}>
          {d.items.map((i) => (
            <Row key={i.id} item={i} app={byRepo.get(i.app)} when={agendaTime(i)} done={agendaStatus(i, now) === 'done'} />
          ))}
        </Day>
      ))}
    </div>
  );
}

function Day({ label, attention, children }: { label: string; attention?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className={`mb-2 ${overline} ${attention ? 'text-terracotta-dark' : ''}`}>{label}</h3>
      <ul className={`${cardClass} divide-y divide-stone-200`}>{children}</ul>
    </section>
  );
}

function Row({ item, app, when, attention, done }: { item: AgendaItem; app?: HouseholdApp; when: string; attention?: boolean; done?: boolean }) {
  const meta = itemMeta(item);
  return (
    <li>
      <a href={item.url} className="flex min-h-14 items-center gap-4 px-5 py-3 hover:bg-forest-50">
        <span className={`w-20 shrink-0 text-sm tabular-nums sm:w-44 sm:text-base ${attention ? 'font-medium text-terracotta-dark' : 'text-stone-600'}`}>{when}</span>
        <ItemIcon item={item} app={app} size={28} />
        <span className="min-w-0 flex-1">
          <span className={`block font-medium [overflow-wrap:break-word] ${done ? 'text-stone-600 line-through' : 'text-stone-800'}`}>{item.title}</span>
          {meta && <span className="block text-sm text-stone-600 [overflow-wrap:break-word]">{meta}</span>}
        </span>
        <span className="sr-only">
          {KIND_WORDS[item.kind]}
          {done ? ', done' : ''}.
        </span>
        {app && <span className="sr-only shrink-0 text-sm text-stone-600 sm:not-sr-only">{app.name}</span>}
      </a>
    </li>
  );
}
