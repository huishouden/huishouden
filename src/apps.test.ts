import { describe, expect, it } from 'bun:test';
import registry from '../apps.json';
import fixtures from './__fixtures__/portal-layouts.json';
import { APPS, arrangeTiles, layoutOf, parseLayout, sameLayout, tilesFrom, type RegistryEntry } from './apps';

const repos = (apps: { repo: string }[]) => apps.map((a) => a.repo);

describe('default order', () => {
  it('starts with the everyday apps, then Spending, then Baby', () => {
    expect(APPS.map((a) => a.name).slice(0, 7)).toEqual(['Tasks', 'Home', 'Pet', 'Car', 'Bills', 'Spending', 'Baby']);
  });

  it('keeps the portal first in the registry and off the tiles', () => {
    expect(registry[0].repo).toBe('portal');
    expect(repos(APPS)).not.toContain('portal');
  });

  it('is the registry order when the household has no layout', () => {
    const { shown, more } = arrangeTiles(APPS);
    expect(repos(shown)).toEqual(repos(tilesFrom(registry as RegistryEntry[])));
    expect(more).toEqual([]);
  });
});

describe('a household layout', () => {
  it('puts tiles in its order and moves hidden apps under More apps', () => {
    const { shown, more } = arrangeTiles(APPS, parseLayout(fixtures.saved));
    expect(repos(shown)).toEqual(['pet', 'tasks', 'home', 'car', 'bills']);
    expect(repos(more)).toEqual(['spending', 'baby']);
  });

  it('shows apps it never placed after its own, in registry order', () => {
    const { all } = arrangeTiles(APPS, parseLayout(fixtures.beforeNewApps));
    expect(repos(all)).toEqual(['home', 'tasks', 'pet', 'car', 'bills', 'spending', 'baby']);
  });

  it('ignores malformed entries and apps no longer in the registry', () => {
    const layout = parseLayout(fixtures.malformed);
    expect(layout).toEqual({ order: ['home', 'retired-app'], hidden: [] });
    expect(repos(arrangeTiles(APPS, layout).all)[0]).toBe('home');
    expect(arrangeTiles(APPS, layout).all).toHaveLength(APPS.length);
  });

  it('reads a missing document as the default', () => {
    expect(parseLayout(undefined)).toEqual({ order: [], hidden: [] });
  });

  it('saves every app in order, and only hidden apps that exist', () => {
    const layout = layoutOf(APPS, ['baby', 'retired-app']);
    expect(layout.order).toEqual(repos(APPS));
    expect(layout.hidden).toEqual(['baby']);
  });

  it('compares hidden apps regardless of order', () => {
    expect(sameLayout({ order: ['a', 'b'], hidden: ['x', 'y'] }, { order: ['a', 'b'], hidden: ['y', 'x'] })).toBe(true);
    expect(sameLayout({ order: ['a', 'b'], hidden: [] }, { order: ['b', 'a'], hidden: [] })).toBe(false);
  });
});
