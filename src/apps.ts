import { logoSvg, type Glyph } from '@huishouden/pwa-kit/logo';
import registry from '../apps.json';

/** One entry of apps.json, the suite's single list of apps (also read by the bootstrap). */
export interface RegistryEntry {
  name: string;
  description?: string;
  repo: string;
  /** The app's own Hosting site: its old address, and its staging site's name. */
  site: string;
  /** Its path on the shared site (pwa-kit docs/one-site.md): `/` for the portal, `/<repo>/` for an app. */
  path?: string;
  /** Its old address redirects to the path, so tiles link to the path. */
  redirect?: boolean;
  webApp?: string;
  glyph: Glyph;
  /** False for the portal itself. */
  tile?: boolean;
  /** False when another session wires the app's hosting and deploys. */
  provision?: boolean;
  /** The roles the app offers for household contacts, when it shows contacts. */
  contactRoles?: string[];
}

export interface HouseholdApp {
  /** The app's repo name, which a household's saved layout refers to it by. */
  repo: string;
  name: string;
  description: string;
  url: string;
  /** The app's own family logo, so the tile matches its installed icon. */
  icon: string;
  /** Roles the app offers for contacts; empty when it doesn't show contacts. */
  contactRoles: string[];
}

/** Where an app opens: its path on this site (pwa-kit docs/one-site.md), or its own site before it moved. */
export const appHref = (app: Pick<RegistryEntry, 'site' | 'path' | 'redirect'>): string =>
  app.path && app.redirect ? app.path : `https://${app.site}.web.app/`;

export function tilesFrom(entries: RegistryEntry[]): HouseholdApp[] {
  return entries
    .filter((app) => app.tile !== false)
    .map((app) => ({
      repo: app.repo,
      name: app.name,
      description: app.description ?? '',
      url: appHref(app),
      icon: logoSvg(app.glyph),
      contactRoles: app.contactRoles ?? [],
    }));
}

export const APPS = tilesFrom(registry as RegistryEntry[]);

/**
 * A link an app stored (an agenda item's `url`) as this site's path when it points at an app's
 * old address or at the shared site itself, so it opens inside the installed portal rather than
 * through a redirect in a browser tab. Anything else is left as it is.
 */
export function suiteLink(url: string, entries: RegistryEntry[] = registry as RegistryEntry[]): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const rest = `${u.pathname.replace(/^\//, '')}${u.search}${u.hash}`;
  const portal = entries.find((e) => e.path === '/');
  if (portal && u.hostname === `${portal.site}.web.app`) return `/${rest}`;
  const app = entries.find((e) => e.path && e.redirect && u.hostname === `${e.site}.web.app`);
  return app ? `${app.path}${rest}` : url;
}

/**
 * A household's own tile layout (`households/{id}/settings/portal`): app repo names in the order
 * it chose, and the ones it hid. Empty lists mean the registry's default.
 */
export interface PortalLayout {
  order: string[];
  hidden: string[];
}

/** The most entries either list may hold, and the longest name (the rules enforce both). */
export const MAX_LAYOUT_APPS = 30;
export const MAX_LAYOUT_NAME = 40;

export const DEFAULT_LAYOUT: PortalLayout = { order: [], hidden: [] };

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_LAYOUT_NAME);
  return [...new Set(valid)].slice(0, MAX_LAYOUT_APPS);
}

/** Reads a stored layout, ignoring anything malformed rather than failing on it. */
export function parseLayout(data: unknown): PortalLayout {
  if (!data || typeof data !== 'object') return DEFAULT_LAYOUT;
  const d = data as Record<string, unknown>;
  return { order: names(d.order), hidden: names(d.hidden) };
}

/**
 * The tiles in the household's order: the apps it ordered first, then any it hasn't placed (apps
 * added to the registry since) in registry order. Hidden apps move to `more`, in the same order.
 * Names that are no longer in the registry are ignored.
 */
export function arrangeTiles(apps: HouseholdApp[], layout: PortalLayout = DEFAULT_LAYOUT) {
  const byRepo = new Map(apps.map((a) => [a.repo, a]));
  const ordered = layout.order.flatMap((repo) => byRepo.get(repo) ?? []);
  const placed = new Set(ordered.map((a) => a.repo));
  const all = [...ordered, ...apps.filter((a) => !placed.has(a.repo))];
  const hidden = new Set(layout.hidden);
  return {
    all,
    shown: all.filter((a) => !hidden.has(a.repo)),
    more: all.filter((a) => hidden.has(a.repo)),
  };
}

/** The layout to save for apps in this order with these hidden, limited to what the rules accept. */
export function layoutOf(ordered: HouseholdApp[], hidden: Iterable<string>): PortalLayout {
  const repos = new Set(ordered.map((a) => a.repo));
  return {
    order: ordered.map((a) => a.repo).slice(0, MAX_LAYOUT_APPS),
    hidden: [...new Set(hidden)].filter((r) => repos.has(r)).slice(0, MAX_LAYOUT_APPS),
  };
}

export function sameLayout(a: PortalLayout, b: PortalLayout): boolean {
  return a.order.join('/') === b.order.join('/') && [...a.hidden].sort().join('/') === [...b.hidden].sort().join('/');
}
