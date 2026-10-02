import type { AgendaItem } from '@huishouden/pwa-kit/agenda';
import { AlarmClock, CalendarClock, CalendarDays, Cake, CheckSquare, Pill, Receipt, RefreshCw, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import type { HouseholdApp } from '../apps';
import { AppIcon } from './AppIcon';

/** What kind of thing an agenda item is, shown as its icon so a row reads at a glance ("a meal", "a bill"). */
const KIND_ICONS: Record<AgendaItem['kind'], LucideIcon> = {
  appointment: CalendarClock,
  due: AlarmClock,
  renewal: RefreshCw,
  bill: Receipt,
  birthday: Cake,
  medicine: Pill,
  feeding: UtensilsCrossed,
  task: CheckSquare,
  other: CalendarDays,
};

export const KIND_WORDS: Record<AgendaItem['kind'], string> = {
  appointment: 'Appointment',
  due: 'Due',
  renewal: 'Renewal',
  bill: 'Bill',
  birthday: 'Birthday',
  medicine: 'Medicine',
  feeding: 'Meal',
  task: 'Task',
  other: 'Event',
};

/** The item's kind as the main icon, with its app's logo as a small badge in the corner. */
export function ItemIcon({ item, app, size }: { item: AgendaItem; app?: HouseholdApp; size: number }) {
  const Icon = KIND_ICONS[item.kind] ?? CalendarDays;
  const badge = Math.round(size * 0.45);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} aria-hidden="true">
      {/* With a badge, the kind icon sits toward the top left so the badge doesn't cover it. */}
      <span
        className="flex h-full w-full items-center justify-center rounded-xl bg-forest-50 text-forest-700"
        style={app ? { paddingRight: Math.round(size * 0.16), paddingBottom: Math.round(size * 0.16) } : undefined}
      >
        <Icon size={Math.round(size * 0.55)} strokeWidth={2} />
      </span>
      {app && (
        <span className="absolute -right-1 -bottom-1 rounded-md ring-2 ring-white">
          <AppIcon app={app} size={badge} />
        </span>
      )}
    </span>
  );
}

/** "Milo · dry food, 1 cup": who and detail, leaving out `who` when the title already names them. */
export function itemMeta(item: Pick<AgendaItem, 'title' | 'who' | 'detail'>): string {
  const who = item.who && !item.title.toLowerCase().includes(item.who.toLowerCase()) ? item.who : undefined;
  return [who, item.detail].filter(Boolean).join(' · ');
}
