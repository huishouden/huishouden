import type { AgendaItem } from '@huishouden/pwa-kit/agenda';
import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';
import type { FoodInput, FoodPreferences } from '@huishouden/pwa-kit/food';
import type { Invitation } from '@huishouden/pwa-kit/invite';
import { householdRole, type Role } from '@huishouden/pwa-kit/roles';
import type { PortalLayout } from './apps';

/** The signed-in person as the app bar shows them. */
export interface HubUser {
  name: string | null;
  email: string;
  photoURL: string | null;
}

export interface MemberProfile {
  name?: string;
  photoURL?: string;
}

export interface ReadyHousehold {
  status: 'ready';
  id: string;
  name: string;
  /** Lowercase emails. */
  members: string[];
  joined: string[];
  /** Roles written out; anyone missing is a member, except the creator (first), an admin. */
  roles: Record<string, Role>;
  profiles: Record<string, MemberProfile>;
}

export type HouseholdView =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'none'; suggestedName: string }
  | ReadyHousehold;

/**
 * Everything the hub shows. `src/data/live.ts` derives it from sign-in and Firestore; the screenshot
 * and smoke tests set it directly with `window.__hubPreview(state)` (invented data, no sign-in).
 */
export type HubState =
  /**
   * Before sign-in is known: nothing yet, so members never glimpse the signed-out introduction.
   * `remembered`: this device last saw a member signed in (src/memberHint.ts), so the hub lays out
   * Today while the session restores.
   */
  | { auth: 'starting'; layout?: PortalLayout; remembered?: boolean }
  | { auth: 'signed-out'; layout?: PortalLayout; remembered?: undefined }
  | {
      auth: 'signed-in';
      /** As for 'starting': keeps the member layout while the household loads. */
      remembered?: boolean;
      user: HubUser;
      /** Lowercase email. */
      me: string;
      household: HouseholdView;
      /** The household's saved tile layout; the registry's order when there is none. */
      layout?: PortalLayout;
      /** Every household contact, whichever apps show it; undefined while loading. */
      contacts?: Contact[];
      /** Every app's dated things (`households/{id}/agenda`), soonest first; undefined while loading. */
      agenda?: AgendaItem[];
      /** Who eats at home and what suits them (`settings/food`); undefined while loading. */
      food?: FoodPreferences;
    };

/** What the person can ask for. Each returns once done and throws an Error worded for people. */
export interface HubActions {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  createHousehold(name: string): Promise<void>;
  renameHousehold(name: string): Promise<void>;
  /** Adds the member with a role (admins only) and returns the invitation to offer by email. */
  invite(email: string, role: Role): Promise<Invitation>;
  removeMember(email: string): Promise<void>;
  setRole(email: string, role: Role): Promise<void>;
  sendInviteEmail(invitation: Invitation): Promise<void>;
  saveLayout(layout: PortalLayout): Promise<void>;
  addContact(input: ContactInput): Promise<void>;
  updateContact(id: string, input: ContactInput): Promise<void>;
  deleteContact(contact: Contact): Promise<void>;
  restoreContact(contact: Contact): Promise<void>;
  saveFood(input: FoodInput): Promise<void>;
}

/** Longest household name the panel accepts. */
export const MAX_NAME = 60;

/** "Sam's household" from a Google name of "Sam Example"; a plain fallback without one. */
export function suggestedHouseholdName(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `${first}'s household` : 'Our household';
}

export const isMember = (s: HubState): s is Extract<HubState, { auth: 'signed-in' }> & { household: ReadyHousehold } =>
  s.auth === 'signed-in' && s.household.status === 'ready';

/** The signed-in person's role in their household; null without one. */
export const myRole = (s: HubState): Role | null => (isMember(s) ? householdRole(s.household, s.me) : null);
