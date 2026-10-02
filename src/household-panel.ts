import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { forgetSilentSignIn, signInSilently } from '@huishouden/pwa-kit/auth';
import {
  createHousehold,
  inviteMember,
  markJoined,
  normalizeEmail,
  removeMember,
  saveMyProfile,
  watchHousehold,
  watchProfiles,
  type HouseholdState,
  type Profile,
} from '@huishouden/pwa-kit/household';
import { sendInviteEmail, type Invitation } from '@huishouden/pwa-kit/invite';
import { googleAccessMessage } from '@huishouden/pwa-kit/feedback';
import { auth, db, googleClientId } from './firebase';
import { MAX_NAME, type HhHousehold, type PanelMessage, type PanelView } from './household-view';

/** "Sam's household" from a Google name of "Sam Example"; a plain fallback without one. */
export function suggestedHouseholdName(displayName: string | null | undefined): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `${first}'s household` : 'Our household';
}

/**
 * The household panel: starting a household, who is in it, and inviting more. Membership here is
 * what every household app checks, so an invite opens all of them at once. This module wires sign-in
 * and Firestore to the `<hh-household>` view (src/household-view.ts).
 */
export function mountHouseholdPanel(panel: HhHousehold) {
  let user: User | null = null;
  let state: HouseholdState = { status: 'loading' };
  let profiles = new Map<string, Profile>();
  let invited: Invitation | undefined;
  let sending = false;
  let creating = false;
  let focusInvite = false;
  let message: PanelMessage | undefined;
  let stopWatching: (() => void) | undefined;
  let stopProfiles: (() => void) | undefined;

  function compose(): PanelView {
    if (!user?.email) return { status: 'signed-out', message };
    const me = normalizeEmail(user.email);
    if (state.status === 'loading') return { status: 'loading', me };
    if (state.status === 'error') return { status: 'error', me, error: state.error.message };
    if (state.status === 'none') {
      return { status: 'none', me, suggestedName: suggestedHouseholdName(user.displayName), creating, message };
    }
    return {
      status: 'ready',
      me,
      household: state.household,
      profiles: Object.fromEntries(profiles),
      invited,
      sending,
      focusInvite,
      message,
    };
  }

  function update() {
    const view = compose();
    panel.view = view;
    if (view.status === 'ready') focusInvite = false;
  }

  /** Runs a household action, showing its error (or a notice) in the panel. */
  async function act(run: () => Promise<void>, notice?: string) {
    message = undefined;
    try {
      await run();
      if (notice) message = { kind: 'notice', text: notice };
    } catch (e) {
      message = { kind: 'error', text: e instanceof Error ? e.message : String(e) };
    }
    update();
  }

  const householdId = () => (state.status === 'ready' ? state.household.id : undefined);

  panel.addEventListener('hh-sign-in', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      message = { kind: 'error', text: e instanceof Error ? e.message : String(e) };
      update();
    });
  });

  panel.addEventListener('hh-sign-out', async () => {
    await forgetSilentSignIn();
    await signOut(auth);
  });

  panel.addEventListener('hh-create', (e) => {
    const name = (e as CustomEvent<string>).detail.slice(0, MAX_NAME);
    if (!user?.email || creating) return;
    const email = user.email;
    creating = true;
    update();
    void act(async () => {
      try {
        await createHousehold(db, email, name);
        // The watch turns ready once the server has the household; land on the invite field then.
        focusInvite = true;
      } catch (err) {
        creating = false;
        throw err;
      }
    });
  });

  panel.addEventListener('hh-rename', (e) => {
    const id = householdId();
    const name = (e as CustomEvent<string>).detail.slice(0, MAX_NAME);
    if (id) void act(() => updateDoc(doc(db, 'households', id), { name }));
  });

  panel.addEventListener('hh-invite', (e) => {
    const id = householdId();
    if (!id || state.status !== 'ready' || !user?.email) return;
    const to = normalizeEmail((e as CustomEvent<string>).detail);
    const me = normalizeEmail(user.email);
    const from = profiles.get(me)?.name ?? user.displayName ?? me;
    const householdName = state.household.name;
    void act(async () => {
      await inviteMember(db, id, to);
      panel.clearInvite();
      invited = { to, from, householdName, url: location.origin };
    });
  });

  panel.addEventListener('hh-remove', (e) => {
    const id = householdId();
    if (id) void act(() => removeMember(db, id, (e as CustomEvent<string>).detail));
  });

  panel.addEventListener('hh-send-invite', () => {
    if (!invited || sending) return;
    const invitation = invited;
    sending = true;
    update();
    void act(async () => {
      try {
        await sendInviteEmail(auth, invitation);
        invited = undefined;
      } catch (e) {
        throw new Error(googleAccessMessage(e, 'Gmail') ?? (e instanceof Error ? e.message : String(e)));
      } finally {
        sending = false;
      }
    }, 'Invite email sent.');
  });

  panel.addEventListener('hh-dismiss-invite', () => {
    invited = undefined;
    update();
  });

  onAuthStateChanged(auth, (next) => {
    stopWatching?.();
    stopProfiles?.();
    stopWatching = stopProfiles = undefined;
    user = next;
    state = { status: 'loading' };
    profiles = new Map();
    invited = undefined;
    sending = creating = focusInvite = false;
    message = undefined;
    if (!next?.email) return update();
    const email = next.email;
    let watchedId: string | undefined;
    stopWatching = watchHousehold(db, email, (s) => {
      state = s;
      if (s.status !== 'none') creating = false;
      update();
      if (s.status !== 'ready') return;
      const household = s.household;
      void markJoined(db, household, email).catch(() => {});
      if (household.id === watchedId) return;
      watchedId = household.id;
      stopProfiles?.();
      // Members' names and photos come from their own sign-ins; record ours for the others.
      void saveMyProfile(db, household.id, next).catch(() => {});
      stopProfiles = watchProfiles(db, household.id, (p) => {
        profiles = p;
        update();
      });
    });
  });

  // Signs in without a click when the browser is signed in to Google and has used this site before.
  if (googleClientId) void signInSilently(auth, googleClientId);
}
