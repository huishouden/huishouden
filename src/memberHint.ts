import type { HubState } from './hub';

/**
 * This device's memory that a household member is signed in, so a reload shows the member's layout
 * (Today) while Firebase restores the session instead of flashing the signed-out introduction.
 * Written once the household is known, removed on sign-out or when the session turns out gone.
 */
export const MEMBER_HINT = 'hh-portal-member';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The remembered household's id, if this device last saw a member signed in. */
export function rememberedHousehold(store: Store | undefined): string | undefined {
  try {
    const raw = store?.getItem(MEMBER_HINT);
    const id = raw ? (JSON.parse(raw) as { household?: unknown }).household : undefined;
    return typeof id === 'string' && id ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers the household when there is one; forgets it otherwise. */
export function rememberHousehold(store: Store | undefined, householdId: string | undefined) {
  try {
    if (householdId) store?.setItem(MEMBER_HINT, JSON.stringify({ household: householdId }));
    else store?.removeItem(MEMBER_HINT);
  } catch {
    // Private browsing without storage: a reload shows the introduction until sign-in resolves.
  }
}

/**
 * Whether to lay the hub out for a member while sign-in or the household is still loading: only
 * when this device remembers one. Once either resolves, the real state decides.
 */
export const restoringMember = (s: HubState): boolean =>
  s.remembered === true && (s.auth === 'starting' || (s.auth === 'signed-in' && s.household.status === 'loading'));
