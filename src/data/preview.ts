import { useMemo, useSyncExternalStore } from 'react';
import type { Contact } from '@huishouden/pwa-kit/contacts';
import { foodDoc } from '@huishouden/pwa-kit/food';
import type { HubActions, HubState } from '../hub';

/**
 * A preview: the hub showing a state it was handed instead of the live one. The screenshot and smoke
 * tests can't sign in to Google, so they call `window.__hubPreview(state)` with invented data; the
 * actions then change only that state in this tab (nothing reaches Firestore).
 * `window.__hubPreview(null)` goes back to the live state.
 */
let preview: HubState | null = null;
const listeners = new Set<() => void>();

function setPreview(next: HubState | null) {
  preview = next;
  listeners.forEach((l) => l());
}

declare global {
  interface Window {
    __hubPreview?: (state: HubState | null) => void;
  }
}

window.__hubPreview = setPreview;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePreview(): { state: HubState; actions: HubActions } | null {
  const state = useSyncExternalStore(subscribe, () => preview);
  const actions = useMemo(() => previewActions(), []);
  return state ? { state, actions } : null;
}

function update(change: (s: Extract<HubState, { auth: 'signed-in' }>) => Partial<Extract<HubState, { auth: 'signed-in' }>>) {
  if (preview?.auth !== 'signed-in') return;
  setPreview({ ...preview, ...change(preview) });
}

function updateHousehold(change: (h: Extract<HubState, { auth: 'signed-in' }>['household']) => object) {
  update((s) => (s.household.status === 'ready' ? { household: { ...s.household, ...change(s.household) } as typeof s.household } : {}));
}

const contactsOf = (s: Extract<HubState, { auth: 'signed-in' }>) => s.contacts ?? [];

function previewActions(): HubActions {
  return {
    async signIn() {},
    async signOut() {
      setPreview({ auth: 'signed-out' });
    },
    async createHousehold(name) {
      update((s) => ({ household: { status: 'ready', id: 'preview', name, members: [s.me], joined: [s.me], profiles: {} } }));
    },
    async renameHousehold(name) {
      updateHousehold(() => ({ name }));
    },
    async invite(to) {
      const email = to.trim().toLowerCase();
      let from = '';
      let householdName = '';
      update((s) => {
        from = s.user.name ?? s.me;
        if (s.household.status !== 'ready') return {};
        householdName = s.household.name;
        return { household: { ...s.household, members: [...new Set([...s.household.members, email])] } };
      });
      return { to: email, from, householdName, url: location.origin };
    },
    async removeMember(email) {
      updateHousehold((h) => (h.status === 'ready' ? { members: h.members.filter((m) => m !== email) } : {}));
    },
    async sendInviteEmail() {},
    async saveLayout(layout) {
      update(() => ({ layout }));
    },
    async addContact(input) {
      update((s) => ({
        contacts: [...contactsOf(s), { ...input, id: `preview-${Date.now()}`, createdAt: Date.now(), by: s.me } as Contact].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }));
    },
    async updateContact(id, input) {
      update((s) => ({ contacts: contactsOf(s).map((c) => (c.id === id ? { ...input, id, createdAt: c.createdAt, by: s.me, updatedAt: Date.now() } : c)) }));
    },
    async deleteContact(contact) {
      update((s) => ({ contacts: contactsOf(s).filter((c) => c.id !== contact.id) }));
    },
    async saveFood(input) {
      update((s) => ({ food: foodDoc(input, s.me) }));
    },
    async restoreContact(contact) {
      update((s) => ({ contacts: [...contactsOf(s), contact].sort((a, b) => a.name.localeCompare(b.name)) }));
    },
  };
}
