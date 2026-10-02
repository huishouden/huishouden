import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import { ghostButton, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { AppIcon as Icon } from './AppIcon';
import { arrangeTiles, layoutOf, sameLayout, type HouseholdApp, type PortalLayout } from '../apps';

interface Props {
  apps: HouseholdApp[];
  layout?: PortalLayout;
  /** A signed-in member of a household, who may arrange its tiles. */
  canArrange: boolean;
  onSave: (layout: PortalLayout, previous: PortalLayout) => void;
}

const tileBase = 'flex flex-col gap-1.5 rounded-3xl bg-white text-stone-800 shadow-sm';

function Tile({ app }: { app: HouseholdApp }) {
  return (
    <a
      href={app.url}
      data-app={app.repo}
      className={`${tileBase} min-h-[180px] border border-stone-200 px-6 py-7 no-underline transition-[box-shadow,transform] duration-150 ease-out hover:shadow-md focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-terracotta active:scale-[0.98]`}
    >
      <span className="mb-2">
        <Icon app={app} size={56} />
      </span>
      <span className="text-[1.375rem] font-semibold text-forest-700">{app.name}</span>
      <span className="text-stone-600">{app.description}</span>
    </a>
  );
}

function SmallTile({ app }: { app: HouseholdApp }) {
  return (
    <a
      href={app.url}
      data-app={app.repo}
      className="flex min-h-14 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-forest-700 shadow-sm hover:shadow-md"
    >
      <Icon app={app} size={36} />
      {app.name}
    </a>
  );
}

/**
 * The app tiles in the household's order, its hidden apps under "More apps", and arranging them
 * (members only): earlier/later buttons, Hide/Show, and dragging with a mouse or trackpad. Escape or
 * Cancel discards; Done saves for everyone in the household.
 */
export function Tiles({ apps, layout, canArrange, onSave }: Props) {
  const { all, shown, more } = arrangeTiles(apps, layout);
  const [arranging, setArranging] = useState(false);
  const [draft, setDraft] = useState<HouseholdApp[]>([]);
  const [draftHidden, setDraftHidden] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState('');
  const [dragging, setDragging] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [focusKey, setFocusKey] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const fine = typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;

  useEffect(() => {
    if (!canArrange) setArranging(false);
  }, [canArrange]);

  // Focus stays on the control that was used, through re-renders and mode changes.
  useEffect(() => {
    if (!focusKey) return;
    root.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusKey)}"]`)?.focus();
    setFocusKey(undefined);
  }, [focusKey, arranging, draft, draftHidden]);

  const start = () => {
    setDraft(all);
    setDraftHidden(new Set(more.map((a) => a.repo)));
    setAnnounce('');
    setArranging(true);
    setFocusKey('title');
  };

  const stop = (save: boolean) => {
    const previous = layoutOf(all, more.map((a) => a.repo));
    const next = layoutOf(draft, draftHidden);
    setArranging(false);
    setFocusKey('arrange');
    if (save && !sameLayout(previous, next)) onSave(next, previous);
  };

  const move = (repo: string, to: number) => {
    const from = draft.findIndex((a) => a.repo === repo);
    if (from < 0 || to < 0 || to >= draft.length || from === to) return;
    const next = [...draft];
    const [app] = next.splice(from, 1);
    next.splice(to, 0, app);
    setDraft(next);
    setAnnounce(`${app.name} moved to ${to + 1} of ${next.length}.`);
  };

  if (!arranging) {
    return (
      <div ref={root}>
        <nav aria-label="Household apps" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
          {shown.map((a) => (
            <Tile key={a.repo} app={a} />
          ))}
        </nav>
        {(more.length > 0 || canArrange) && (
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            {more.length > 0 && (
              <details className="group flex-1">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-1 font-medium text-forest-700 [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={18} aria-hidden="true" className="transition-transform duration-150 group-open:rotate-90" />
                  More apps <span className="text-stone-600">({more.length})</span>
                </summary>
                <nav aria-label="More apps" className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                  {more.map((a) => (
                    <SmallTile key={a.repo} app={a} />
                  ))}
                </nav>
              </details>
            )}
            {canArrange && (
              <button type="button" data-key="arrange" className={`${ghostButton} ml-auto`} onClick={start}>
                Arrange
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const last = draft.length - 1;
  return (
    <div
      ref={root}
      className="@container"
      onKeyDown={(e) => {
        if (e.key === 'Escape') stop(false);
      }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div>
          <h2 tabIndex={-1} data-key="title" className="text-xl font-semibold text-forest-700 outline-none">
            Arrange apps
          </h2>
          <p className="text-stone-600">Move apps, or hide the ones your household doesn't use. Everyone in the household sees this layout.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={ghostButton} onClick={() => stop(false)}>
            Cancel
          </button>
          <button type="button" className={primaryButton} onClick={() => stop(true)}>
            Done
          </button>
        </div>
      </div>
      <ol aria-label="Household apps, in order" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
        {draft.map((app, i) => {
          const hidden = draftHidden.has(app.repo);
          const drag = fine
            ? {
                draggable: true,
                onDragStart: (e: React.DragEvent) => {
                  setDragging(app.repo);
                  e.dataTransfer.setData('text/plain', app.repo);
                  e.dataTransfer.effectAllowed = 'move';
                },
                onDragEnd: () => {
                  setDragging(undefined);
                  setDropTarget(undefined);
                },
                onDragOver: (e: React.DragEvent) => {
                  if (!dragging || dragging === app.repo) return;
                  e.preventDefault();
                  setDropTarget(app.repo);
                },
                onDragLeave: () => setDropTarget((t) => (t === app.repo ? undefined : t)),
                onDrop: (e: React.DragEvent) => {
                  e.preventDefault();
                  if (dragging) move(dragging, i);
                  setDragging(undefined);
                  setDropTarget(undefined);
                },
              }
            : {};
          return (
            <li
              key={app.repo}
              {...drag}
              className={`${tileBase} px-5 pt-5 pb-3 ${fine ? 'cursor-grab' : ''} ${dragging === app.repo ? 'opacity-50' : ''} ${
                dropTarget === app.repo ? 'outline-3 outline-offset-3 outline-forest-500 outline-dashed' : ''
              } ${hidden ? 'border border-dashed border-stone-300 bg-transparent shadow-none' : 'border border-stone-200'}`}
            >
              <span className={`mb-2 ${hidden ? 'opacity-45' : ''}`}>
                <Icon app={app} size={56} />
              </span>
              <span className="text-[1.375rem] font-semibold text-forest-700">
                {app.name}
                {hidden && (
                  <span className="ml-1.5 rounded-full bg-stone-200 px-2 py-0.5 align-middle text-xs font-medium text-stone-600">Hidden</span>
                )}
              </span>
              <span className="mb-2 text-stone-600">{hidden ? 'Under More apps' : app.description}</span>
              <span className="mt-auto flex items-center gap-1 border-t border-stone-200 pt-2">
                <MoveButton
                  dir="up"
                  app={app}
                  disabled={i === 0}
                  onClick={() => {
                    move(app.repo, i - 1);
                    setFocusKey(i - 1 === 0 ? `down:${app.repo}` : `up:${app.repo}`);
                  }}
                />
                <MoveButton
                  dir="down"
                  app={app}
                  disabled={i === last}
                  onClick={() => {
                    move(app.repo, i + 1);
                    setFocusKey(i + 1 === last ? `up:${app.repo}` : `down:${app.repo}`);
                  }}
                />
                <button
                  type="button"
                  data-key={`toggle:${app.repo}`}
                  aria-label={`${hidden ? 'Show' : 'Hide'} ${app.name}`}
                  className={`${ghostButton} ml-auto text-forest-700`}
                  onClick={() => {
                    const next = new Set(draftHidden);
                    if (next.delete(app.repo)) setAnnounce(`${app.name} shown.`);
                    else {
                      next.add(app.repo);
                      setAnnounce(`${app.name} hidden. It stays under More apps.`);
                    }
                    setDraftHidden(next);
                    setFocusKey(`toggle:${app.repo}`);
                  }}
                >
                  {hidden ? 'Show' : 'Hide'}
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" role="status">
        {announce}
      </p>
    </div>
  );
}

function MoveButton({ dir, app, disabled, onClick }: { dir: 'up' | 'down'; app: HouseholdApp; disabled: boolean; onClick: () => void }) {
  const Arrow = dir === 'up' ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      data-key={`${dir}:${app.repo}`}
      aria-label={`Move ${app.name} ${dir === 'up' ? 'earlier' : 'later'}`}
      title={dir === 'up' ? 'Move earlier' : 'Move later'}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-forest-700 hover:bg-forest-50 disabled:text-stone-300 disabled:hover:bg-transparent"
    >
      {/* One column (phones): earlier is up, later is down. */}
      <Arrow size={20} strokeWidth={2.2} aria-hidden="true" className="@max-[499px]:rotate-90" />
    </button>
  );
}
