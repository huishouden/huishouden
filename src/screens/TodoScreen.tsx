import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ExternalLink, X } from 'lucide-react';
import { addedText, canDo, olderThan, todoDueText, todoOverdue, type TodoItem } from '@huishouden/pwa-kit/todos';
import { isRestricted, type Role } from '@huishouden/pwa-kit/roles';
import { RoleNote } from '@huishouden/pwa-kit/react/roles';
import { Chip, Dialog, cardClass, ghostButton, primaryButton, secondaryButton, selectClass } from '@huishouden/pwa-kit/react/ui';
import { suiteLink, type HouseholdApp } from '../apps';
import { AppIcon } from '../components/AppIcon';
import type { HubActions } from '../hub';
import { actedLine, appsWithTodos, bulkLine, cancellable, DEFAULT_VIEW, OLD_DAYS, shownTodos, summaryLine, type TodoView } from '../todo';

interface Props {
  /** Undefined while loading: skeleton rows hold the layout. */
  todos: TodoItem[] | undefined;
  /** Every app in the household's order. */
  apps: HouseholdApp[];
  now: number;
  me?: string;
  role: Role | null;
  actions: HubActions;
  notify: (message: string, undo?: () => void) => void;
  fail: (message: string) => void;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Every app's open things to do in one list, newest first, so the household can see what is
 * waiting anywhere and clear out what nobody is going to do: Done or Cancel on each (in its app's
 * own terms: Pause, Skip, Mark paid), Open in its app, and a bulk Cancel for old ones. What a role
 * can't do is left out; the source app's rules decide every write.
 */
export function TodoScreen({ todos, apps, now, me, role, actions, notify, fail }: Props) {
  const [view, setView] = useState<TodoView>(DEFAULT_VIEW);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<TodoItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const byRepo = useMemo(() => new Map(apps.map((a) => [a.repo, a])), [apps]);
  const order = useMemo(() => apps.map((a) => a.repo), [apps]);
  const items = todos ?? [];
  const shown = shownTodos(items, view, order, now);
  const withItems = appsWithTodos(items.filter((i) => i.status === 'open'), order);
  const oldCount = items.filter((i) => olderThan(i, now, OLD_DAYS)).length;
  const canCancelShown = cancellable(shown, role, me);
  const selectedItems = canCancelShown.filter((i) => selected.has(i.id));
  const someoneElses = isRestricted(role) && items.some((i) => i.status === 'open' && i.cancel && !canDo(i, 'cancel', role, me));
  const appName = (repo: string) => byRepo.get(repo)?.name ?? repo;

  const run = async (item: TodoItem, which: 'done' | 'cancel') => {
    const action = item[which]!;
    try {
      const done = await actions.runTodo(item, which);
      done.written.catch((e) => fail(message(e)));
      notify(actedLine(action.label, item.title), () => void done.undo().catch((e) => fail(message(e))));
    } catch (e) {
      fail(message(e));
    }
  };

  const cancelAll = async (list: TodoItem[]) => {
    setBusy(true);
    const undos: (() => Promise<void>)[] = [];
    try {
      for (const item of list) {
        const done = await actions.runTodo(item, 'cancel');
        done.written.catch((e) => fail(message(e)));
        undos.push(done.undo);
      }
      setSelecting(false);
      setSelected(new Set());
      notify(bulkLine(undos.length), () => void Promise.all(undos.map((u) => u())).catch((e) => fail(message(e))));
    } catch (e) {
      fail(undos.length ? `${bulkLine(undos.length)} ${message(e)}` : message(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSort = (sort: TodoView['sort']) => setView((v) => ({ ...v, sort }));
  const byDate = view.sort === 'newest' || view.sort === 'oldest';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-800">To-do</h2>
          {todos !== undefined && (
            <p className="text-base text-stone-600" aria-live="polite">
              {summaryLine(items, now)}
            </p>
          )}
        </div>
        {canCancelShown.length > 0 && (
          <button
            type="button"
            className={secondaryButton}
            aria-pressed={selecting}
            onClick={() => {
              setSelecting((s) => !s);
              setSelected(new Set());
            }}
          >
            {selecting ? 'Done selecting' : 'Select'}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-600">Sort</span>
            <select className={selectClass} value={view.sort} onChange={(e) => setSort(e.target.value as TodoView['sort'])}>
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="due">Due date</option>
              <option value="app">App</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-600">Show</span>
            <select
              className={selectClass}
              value={view.old ? 'old' : (view.app ?? '')}
              onChange={(e) => {
                const v = e.target.value;
                setView((cur) => ({ ...cur, app: v && v !== 'old' ? v : null, old: v === 'old' }));
              }}
            >
              <option value="">All apps</option>
              {withItems.map((repo) => (
                <option key={repo} value={repo}>
                  {appName(repo)}
                </option>
              ))}
              {oldCount > 0 && <option value="old">Older than {OLD_DAYS} days ({oldCount})</option>}
            </select>
          </label>
        </div>
      )}
      {items.length > 0 && (
        <div className="hidden space-y-2 sm:block">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort">
            <span className="mr-1 text-sm font-medium text-stone-600">Sort</span>
            <Chip
              active={byDate}
              onClick={() => setSort(view.sort === 'newest' ? 'oldest' : 'newest')}
              label={`Date added, ${view.sort === 'oldest' ? 'oldest' : 'newest'} first`}
            >
              Date added
              {view.sort === 'oldest' ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
            </Chip>
            <Chip active={view.sort === 'due'} onClick={() => setSort('due')}>
              Due
            </Chip>
            <Chip active={view.sort === 'app'} onClick={() => setSort('app')}>
              App
            </Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show">
            {withItems.length > 1 && (
              <>
                <Chip active={view.app === null} onClick={() => setView((v) => ({ ...v, app: null }))}>
                  All apps
                </Chip>
                {withItems.map((repo) => (
                  <Chip key={repo} active={view.app === repo} onClick={() => setView((v) => ({ ...v, app: v.app === repo ? null : repo }))}>
                    {appName(repo)}
                  </Chip>
                ))}
              </>
            )}
            {oldCount > 0 && (
              <Chip active={view.old} onClick={() => setView((v) => ({ ...v, old: !v.old }))}>
                Older than {OLD_DAYS} days ({oldCount})
              </Chip>
            )}
          </div>
        </div>
      )}

      {todos === undefined && <Skeleton />}
      {todos !== undefined && shown.length === 0 && (
        <p className={`${cardClass} p-6 text-lg text-stone-600`}>
          {items.length === 0 ? 'Nothing to do in any app. To-dos, jobs, checklists and reminders show here as they come up.' : 'Nothing here with these choices.'}
        </p>
      )}
      {shown.length > 0 && (
        <ul className={`${cardClass} divide-y divide-stone-200`} aria-label="To-do list">
          {shown.map((item) => (
            <Row
              key={item.id}
              item={item}
              app={byRepo.get(item.app)}
              now={now}
              mayDone={canDo(item, 'done', role, me)}
              mayCancel={canDo(item, 'cancel', role, me)}
              selecting={selecting}
              checked={selected.has(item.id)}
              onToggle={() => toggle(item.id)}
              onDone={() => void run(item, 'done')}
              onCancel={() => setConfirm([item])}
            />
          ))}
        </ul>
      )}
      {someoneElses && <RoleNote action="edit-others" />}

      {selecting && (
        <div className="fixed inset-x-0 bottom-(--hh-bottom-nav) z-40 border-t border-stone-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2">
            <span className="text-base font-medium text-stone-800 tabular-nums" aria-live="polite">
              {selectedItems.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={ghostButton}
                onClick={() => setSelected(selectedItems.length === canCancelShown.length ? new Set() : new Set(canCancelShown.map((i) => i.id)))}
              >
                {selectedItems.length === canCancelShown.length ? 'Select none' : `Select all ${canCancelShown.length}`}
              </button>
              <button type="button" className={primaryButton} disabled={selectedItems.length === 0 || busy} onClick={() => setConfirm(selectedItems)}>
                Cancel {selectedItems.length || ''}
              </button>
            </div>
          </div>
        </div>
      )}
      {selecting && <div className="h-20" aria-hidden="true" />}

      {confirm && (
        <ConfirmCancel
          items={confirm}
          appName={appName}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const list = confirm;
            setConfirm(null);
            if (list.length === 1 && !selecting) void run(list[0], 'cancel');
            else void cancelAll(list);
          }}
        />
      )}
    </div>
  );
}

function Row({
  item,
  app,
  now,
  mayDone,
  mayCancel,
  selecting,
  checked,
  onToggle,
  onDone,
  onCancel,
}: {
  item: TodoItem;
  app?: HouseholdApp;
  now: number;
  mayDone: boolean;
  mayCancel: boolean;
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const due = todoDueText(item, now);
  const overdue = todoOverdue(item, now);
  const info = item.status === 'info';
  const appLabel = app?.name ?? item.app;
  const meta = [item.who, item.detail].filter(Boolean).join(' · ');
  return (
    <li aria-label={item.title} className={`flex gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5 ${checked ? 'bg-forest-50' : ''}`}>
      {selecting && (
        <span className="flex h-11 w-8 shrink-0 items-center justify-center">
          {mayCancel && <input type="checkbox" className="h-5 w-5 accent-forest-700" checked={checked} onChange={onToggle} aria-label={`Select ${item.title}`} />}
        </span>
      )}
      {app && (
        <span className="mt-1 shrink-0 sm:mt-0">
          <AppIcon app={app} size={36} />
        </span>
      )}
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-stone-800 [overflow-wrap:break-word]">{item.title}</p>
          <p className="text-sm text-stone-600 [overflow-wrap:break-word]">
            <span className="font-medium">{appLabel}</span>
            {meta && ` · ${meta}`}
            {due && (
              <>
                {' · '}
                <span className={overdue ? 'font-medium text-terracotta-dark' : ''}>{due}</span>
              </>
            )}
            {!info && ` · ${addedText(item, now)}`}
          </p>
        </div>
        {!selecting && (
          <div className="mt-2 flex flex-wrap items-center gap-1 sm:mt-0 sm:shrink-0 sm:justify-end">
            {mayDone && item.done && (
              <button type="button" className={`${secondaryButton} px-3`} data-todo-action="done" aria-label={`${item.done.label}: ${item.title}`} onClick={onDone}>
                <Check size={18} aria-hidden="true" />
                {item.done.label}
              </button>
            )}
            {mayCancel && item.cancel && (
              <button type="button" className={ghostButton} data-todo-action="cancel" aria-label={`${item.cancel.label}: ${item.title}`} onClick={onCancel}>
                <X size={18} aria-hidden="true" />
                {item.cancel.label}
              </button>
            )}
            <a
              href={suiteLink(item.url)}
              className={`${ghostButton} min-w-11 text-forest-700`}
              aria-label={`Open ${item.title} in ${appLabel}`}
            >
              <ExternalLink size={18} aria-hidden="true" />
              <span className="hidden sm:inline">Open</span>
            </a>
          </div>
        )}
      </div>
    </li>
  );
}

function ConfirmCancel({ items, appName, onClose, onConfirm }: { items: TodoItem[]; appName: (repo: string) => string; onClose: () => void; onConfirm: () => void }) {
  const one = items.length === 1 ? items[0] : null;
  const label = one ? one.cancel!.label : `Cancel ${items.length}`;
  const title = one ? `${one.cancel!.label} “${one.title}”?` : `Cancel ${items.length} things?`;
  const apps = [...new Set(items.map((i) => appName(i.app)))];
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={secondaryButton} onClick={onClose}>
            Keep {one ? 'it' : 'them'}
          </button>
          <button type="button" className={primaryButton} data-todo-confirm="" onClick={onConfirm}>
            {label}
          </button>
        </>
      }
    >
      {one ? (
        <p className="text-base text-stone-700">It stays in {appName(one.app)}'s history, where it can be brought back.</p>
      ) : (
        <>
          <p className="text-base text-stone-700">Each stays in its app's history ({apps.join(', ')}), where it can be brought back.</p>
          <ul className="mt-3 max-h-60 list-disc space-y-1 overflow-y-auto pl-5 text-base text-stone-700">
            {items.map((i) => (
              <li key={i.id}>{i.title}</li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}

const pulse = 'animate-pulse rounded bg-stone-100 motion-reduce:animate-none';

function Skeleton() {
  return (
    <section aria-busy="true" aria-label="Loading">
      <p className="sr-only">Loading the household's to-dos.</p>
      <ul className={`${cardClass} divide-y divide-stone-200`} aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex min-h-20 items-center gap-3 px-4 py-3 sm:px-5">
            <span className={`h-9 w-9 shrink-0 ${pulse} rounded-xl`} />
            <span className="flex-1 space-y-2">
              <span className={`block h-6 w-2/3 ${pulse}`} />
              <span className={`block h-4 w-1/3 ${pulse}`} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
