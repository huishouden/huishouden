import { describe, expect, it } from 'bun:test';
import type { HubState, ReadyHousehold } from './hub';
import { MEMBER_HINT, rememberHousehold, rememberedHousehold, restoringMember } from './memberHint';

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

const user = { name: 'Sam', email: 'sam@example.com', photoURL: null };
const ready: ReadyHousehold = { status: 'ready', id: 'h1', name: 'Home', members: [], joined: [], roles: {}, profiles: {} };

describe('member hint', () => {
  it('remembers the household and forgets it on sign-out', () => {
    const store = memoryStore();
    expect(rememberedHousehold(store)).toBeUndefined();
    rememberHousehold(store, 'h1');
    expect(rememberedHousehold(store)).toBe('h1');
    rememberHousehold(store, undefined);
    expect(store.data.has(MEMBER_HINT)).toBe(false);
  });

  it('ignores a damaged hint and missing or throwing storage', () => {
    const store = memoryStore();
    store.setItem(MEMBER_HINT, '{not json');
    expect(rememberedHousehold(store)).toBeUndefined();
    store.setItem(MEMBER_HINT, JSON.stringify({ household: 7 }));
    expect(rememberedHousehold(store)).toBeUndefined();
    expect(rememberedHousehold(undefined)).toBeUndefined();
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    expect(rememberedHousehold(throwing)).toBeUndefined();
    expect(() => rememberHousehold(throwing, 'h1')).not.toThrow();
  });
});

describe('restoring a member', () => {
  const cases: [string, HubState, boolean][] = [
    ['sign-in restoring on a remembered device', { auth: 'starting', remembered: true }, true],
    ['sign-in restoring on a new device', { auth: 'starting' }, false],
    ['the household loading on a remembered device', { auth: 'signed-in', remembered: true, user, me: user.email, household: { status: 'loading' } }, true],
    ['the household loading after a first sign-in', { auth: 'signed-in', user, me: user.email, household: { status: 'loading' } }, false],
    ['the household loaded', { auth: 'signed-in', remembered: true, user, me: user.email, household: ready }, false],
    ['no household after all', { auth: 'signed-in', remembered: true, user, me: user.email, household: { status: 'none', suggestedName: 'x' } }, false],
    ['the session gone', { auth: 'signed-out' }, false],
  ];
  for (const [name, state, expected] of cases) it(`${expected ? 'lays out' : 'does not lay out'} the member view: ${name}`, () => expect(restoringMember(state)).toBe(expected));
});
