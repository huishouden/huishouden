import { useEffect, useMemo, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { setDoc, updateDoc } from '@huishouden/pwa-kit/firestore';
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
import { addContact, deleteContact, restoreContact, updateContact, watchContacts, type Contact } from '@huishouden/pwa-kit/contacts';
import { sendInviteEmail } from '@huishouden/pwa-kit/invite';
import { agendaRange, watchAgenda, type AgendaItem } from '@huishouden/pwa-kit/agenda';
import { toYmd } from '@huishouden/pwa-kit/time';
import { saveFood, watchFood, type FoodPreferences } from '@huishouden/pwa-kit/food';
import { googleAccessMessage, readError } from '@huishouden/pwa-kit/feedback';
import { DEFAULT_LAYOUT, parseLayout, type PortalLayout } from '../apps';
import { auth, db, googleClientId } from '../firebase';
import { rememberHousehold, rememberedHousehold } from '../memberHint';
import { MAX_NAME, suggestedHouseholdName, type HouseholdView, type HubActions, type HubState } from '../hub';

const LAYOUT_CACHE = 'hh-portal-layout';

const storage = (): Storage | undefined => {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
};

/** The last layout this browser saw, so a member's tiles don't jump while sign-in resolves. */
function cachedLayout(): PortalLayout | undefined {
  try {
    const raw = localStorage.getItem(LAYOUT_CACHE);
    return raw ? parseLayout(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}

function cacheLayout(layout: PortalLayout | undefined) {
  try {
    if (layout) localStorage.setItem(LAYOUT_CACHE, JSON.stringify(layout));
    else localStorage.removeItem(LAYOUT_CACHE);
  } catch {
    // Private browsing without storage: the tiles still follow the household, just after sign-in.
  }
}

/** Apps publish 180 days ahead (`AGENDA_AHEAD_DAYS`); the hub reads all of it. */
const AGENDA_DAYS = 181;

/** Today's date, changing at midnight (checked every minute). */
function useToday() {
  const [today, setToday] = useState(() => toYmd(Date.now()));
  useEffect(() => {
    const id = setInterval(() => setToday(toYmd(Date.now())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

const words = (e: unknown, doing: string) => new Error(readError(e, doing));

/**
 * The hub's live data: sign-in, the household (members, their own names and photos), its tile
 * layout (`settings/portal`) and every household contact, with the actions that change them.
 */
export function useLiveHub(): { state: HubState; actions: HubActions } {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [household, setHousehold] = useState<HouseholdState>({ status: 'loading' });
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [layout, setLayout] = useState<PortalLayout | undefined>(cachedLayout);
  const [contacts, setContacts] = useState<Contact[] | undefined>(undefined);
  const [agenda, setAgenda] = useState<AgendaItem[] | undefined>(undefined);
  const [food, setFood] = useState<FoodPreferences | undefined>(undefined);
  const [remembered, setRemembered] = useState(() => rememberedHousehold(storage()) !== undefined);
  const today = useToday();

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        if (!u) {
          setLayout(undefined);
          cacheLayout(undefined);
          rememberHousehold(storage(), undefined);
          setRemembered(false);
        }
      }),
    [],
  );

  // Signs in without a click when the browser is signed in to Google and has used this site before.
  useEffect(() => {
    if (googleClientId) void signInSilently(auth, googleClientId);
  }, []);

  const email = user?.email ? normalizeEmail(user.email) : undefined;
  useEffect(() => {
    setHousehold({ status: 'loading' });
    if (!email) return;
    return watchHousehold(db, email, setHousehold);
  }, [email]);

  const ready = household.status === 'ready' ? household.household : undefined;
  const householdId = ready?.id;

  // Remember on this device whether a member is signed in, for the next load (src/memberHint.ts).
  useEffect(() => {
    if (householdId) rememberHousehold(storage(), householdId);
    else if (household.status === 'none') {
      rememberHousehold(storage(), undefined);
      setRemembered(false);
    }
  }, [householdId, household.status]);

  useEffect(() => {
    if (ready && email) markJoined(db, ready, email).catch(() => {});
  }, [ready, email]);

  useEffect(() => {
    setProfiles(new Map());
    setContacts(undefined);
    setFood(undefined);
    if (!householdId || !user) return;
    // Members' names and photos come from their own sign-ins; record ours for the others.
    saveMyProfile(db, householdId, user).catch(() => {});
    const stops = [
      watchProfiles(db, householdId, setProfiles),
      watchContacts(db, householdId, setContacts, { onError: () => setContacts([]) }),
      watchFood(db, householdId, setFood),
      onSnapshot(
        doc(db, 'households', householdId, 'settings', 'portal'),
        (snap) => {
          const next = snap.exists() ? parseLayout(snap.data()) : DEFAULT_LAYOUT;
          cacheLayout(next);
          setLayout(next);
        },
        () => {
          // Unreadable (offline): keep what is shown.
        },
      ),
    ];
    return () => stops.forEach((stop) => stop());
  }, [householdId, user]);

  // The agenda from a week ago (overdue items whatever their age) to as far ahead as apps publish,
  // followed again each new day so a tablet left open keeps the right window.
  useEffect(() => {
    setAgenda(undefined);
    if (!householdId) return;
    const { from, to } = agendaRange(Date.now(), AGENDA_DAYS, 7);
    return watchAgenda(db, householdId, { from, to, onError: () => setAgenda([]) }, setAgenda);
  }, [householdId, today]);

  const state = useMemo((): HubState => {
    if (user === undefined) return { auth: 'starting', layout, remembered };
    if (!user?.email) return { auth: 'signed-out' };
    const me = normalizeEmail(user.email);
    let view: HouseholdView;
    if (household.status === 'loading') view = { status: 'loading' };
    else if (household.status === 'error') view = { status: 'error', error: household.error.message };
    else if (household.status === 'none') view = { status: 'none', suggestedName: suggestedHouseholdName(user.displayName) };
    else {
      const h = household.household;
      view = {
        status: 'ready',
        id: h.id,
        name: h.name,
        members: h.members,
        joined: h.joined,
        profiles: Object.fromEntries([...profiles].map(([k, p]) => [k, { name: p.name, photoURL: p.photoURL }])),
      };
    }
    return {
      auth: 'signed-in',
      remembered,
      user: { name: user.displayName, email: user.email, photoURL: user.photoURL },
      me,
      household: view,
      layout: view.status === 'ready' ? layout : undefined,
      contacts,
      agenda,
      food,
    };
  }, [user, household, profiles, layout, contacts, agenda, food, remembered]);

  const actions = useMemo((): HubActions => {
    const need = () => {
      if (!householdId || !email) throw new Error('Not in a household.');
      return { id: householdId, me: email };
    };
    return {
      async signIn() {
        try {
          await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (e) {
          const code = (e as { code?: string }).code;
          if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
          throw new Error("Couldn't sign in. Try again.");
        }
      },
      async signOut() {
        await forgetSilentSignIn();
        await signOut(auth);
      },
      async createHousehold(name) {
        if (!email) return;
        await createHousehold(db, email, name.slice(0, MAX_NAME)).catch((e) => {
          throw words(e, "Couldn't start the household");
        });
      },
      async renameHousehold(name) {
        const { id } = need();
        await updateDoc(doc(db, 'households', id), { name: name.slice(0, MAX_NAME) }).catch((e) => {
          throw words(e, "Couldn't rename the household");
        });
      },
      async invite(to) {
        const { id, me } = need();
        const address = normalizeEmail(to);
        await inviteMember(db, id, address).catch((e) => {
          throw words(e, "Couldn't invite them");
        });
        return {
          to: address,
          from: profiles.get(me)?.name ?? user?.displayName ?? me,
          householdName: ready?.name ?? 'the household',
          url: location.origin,
        };
      },
      async removeMember(who) {
        const { id } = need();
        await removeMember(db, id, who).catch((e) => {
          throw words(e, "Couldn't remove them");
        });
      },
      async sendInviteEmail(invitation) {
        try {
          await sendInviteEmail(auth, invitation);
        } catch (e) {
          throw new Error(googleAccessMessage(e, 'Gmail') ?? (e instanceof Error ? e.message : String(e)));
        }
      },
      async saveLayout(next) {
        const { id, me } = need();
        const previous = layout;
        setLayout(next);
        try {
          await setDoc(doc(db, 'households', id, 'settings', 'portal'), { ...next, updatedAt: Date.now(), by: me });
        } catch (e) {
          setLayout(previous);
          throw words(e, "Couldn't save the layout");
        }
      },
      async addContact(input) {
        const { id, me } = need();
        await addContact(db, id, input, me).catch((e) => {
          throw words(e, "Couldn't add the contact");
        });
      },
      async updateContact(contactId, input) {
        const { id, me } = need();
        await updateContact(db, id, contactId, input, me).catch((e) => {
          throw words(e, "Couldn't save the contact");
        });
      },
      async deleteContact(contact) {
        const { id } = need();
        await deleteContact(db, id, contact.id).catch((e) => {
          throw words(e, "Couldn't delete the contact");
        });
      },
      async saveFood(input) {
        const { id, me } = need();
        await saveFood(db, id, input, me).catch((e) => {
          throw words(e, "Couldn't save the food preferences");
        });
      },
      async restoreContact(contact) {
        const { id } = need();
        await restoreContact(db, id, contact).catch((e) => {
          throw words(e, "Couldn't restore the contact");
        });
      },
    };
  }, [householdId, email, profiles, user, ready, layout]);

  return { state, actions };
}
