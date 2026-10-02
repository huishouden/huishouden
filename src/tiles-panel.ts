import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { APPS, DEFAULT_LAYOUT, parseLayout, type PortalLayout } from './apps';
import { db } from './firebase';
import type { HhTiles, LayoutSave } from './tiles-view';

/** Who may arrange: a signed-in member of the household, or nobody (the default layout). */
export type TilesHousehold = { id: string; me: string } | null;

const CACHE_KEY = 'hh-portal-layout';

/** The last layout this browser saw, so a member's tiles don't jump while sign-in resolves. */
function cachedLayout(): PortalLayout | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseLayout(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

function cache(layout: PortalLayout | undefined) {
  try {
    if (layout) localStorage.setItem(CACHE_KEY, JSON.stringify(layout));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Private browsing without storage: the tiles still follow the household, just after sign-in.
  }
}

/**
 * The tiles and the household's layout of them (`households/{id}/settings/portal`), wired to the
 * `<hh-tiles>` view (src/tiles-view.ts). Returns the function the household panel calls when the
 * signed-in member's household is known (`undefined` while it is still loading).
 */
export function mountTiles(tiles: HhTiles) {
  let household: TilesHousehold = null;
  let layout: PortalLayout | undefined = cachedLayout();
  let stop: (() => void) | undefined;

  const update = () => (tiles.view = { apps: APPS, layout, canArrange: household !== null });
  update();

  tiles.addEventListener('hh-layout-save', (e) => {
    const { layout: next, previous } = (e as CustomEvent<LayoutSave>).detail;
    if (!household) return;
    const ref = doc(db, 'households', household.id, 'settings', 'portal');
    layout = next;
    update();
    setDoc(ref, { ...next, updatedAt: Date.now(), by: household.me }).catch((err) => {
      layout = previous;
      update();
      tiles.toast(`Couldn't save the layout. ${err instanceof Error ? err.message : String(err)}`, 'error');
    });
  });

  return (next: TilesHousehold | undefined) => {
    if (next === undefined) return;
    if (next?.id === household?.id) {
      household = next;
      return update();
    }
    stop?.();
    stop = undefined;
    household = next;
    if (!next) {
      layout = undefined;
      cache(undefined);
      return update();
    }
    update();
    stop = onSnapshot(
      doc(db, 'households', next.id, 'settings', 'portal'),
      (snap) => {
        layout = snap.exists() ? parseLayout(snap.data()) : DEFAULT_LAYOUT;
        cache(layout);
        update();
      },
      () => {
        // Unreadable (rules not deployed yet, or offline): keep what is shown.
      },
    );
  };
}
