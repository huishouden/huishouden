import { logoSvg, type Glyph } from '@huishouden/pwa-kit/logo';
import registry from '../apps.json';

/** One entry of apps.json, the suite's single list of apps (also read by the bootstrap). */
export interface RegistryEntry {
  name: string;
  description?: string;
  repo: string;
  site: string;
  webApp?: string;
  glyph: Glyph;
  /** False for the portal itself. */
  tile?: boolean;
  /** False when another session wires the app's hosting and deploys. */
  provision?: boolean;
}

export interface HouseholdApp {
  name: string;
  description: string;
  url: string;
  /** The app's own family logo, so the tile matches its installed icon. */
  icon: string;
}

export function tilesFrom(entries: RegistryEntry[]): HouseholdApp[] {
  return entries
    .filter((app) => app.tile !== false)
    .map((app) => ({
      name: app.name,
      description: app.description ?? '',
      url: `https://${app.site}.web.app/`,
      icon: logoSvg(app.glyph),
    }));
}

export const APPS = tilesFrom(registry as RegistryEntry[]);
