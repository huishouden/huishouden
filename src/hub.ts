import type { AgendaItem } from '@huishouden/pwa-kit/agenda';
import type { Contact, ContactInput } from '@huishouden/pwa-kit/contacts';
import type { Invitation } from '@huishouden/pwa-kit/invite';
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
  /** Before sign-in is known: nothing yet, so members never glimpse the signed-out introduction. */
  | { auth: 'starting'; layout?: PortalLayout }
  | { auth: 'signed-out'; layout?: PortalLayout }
  | {
      auth: 'signed-in';
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
    };

/** What the person can ask for. Each returns once done and throws an Error worded for people. */
export interface HubActions {
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  createHousehold(name: string): Promise<void>;
  renameHousehold(name: string): Promise<void>;
  /** Adds the member and returns the invitation to offer by email. */
  invite(email: string): Promise<Invitation>;
  removeMember(email: string): Promise<void>;
  sendInviteEmail(invitation: Invitation): Promise<void>;
  saveLayout(layout: PortalLayout): Promise<void>;
  addContact(input: ContactInput): Promise<void>;
  updateContact(id: string, input: ContactInput): Promise<void>;
  deleteContact(contact: Contact): Promise<void>;
  restoreContact(contact: Contact): Promise<void>;
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
