import { describe, expect, test } from 'bun:test';
import { actedLine, appsWithTodos, bulkLine, cancellable, DEFAULT_VIEW, shownTodos, summaryLine } from './todo';
import { helperTodos, TODO_NOW, todos } from './__fixtures__/todos';

const now = new Date(TODO_NOW).getTime();
const order = ['tasks', 'home', 'pet', 'baby', 'car', 'bills', 'groceries'];
const titles = (list: { title: string }[]) => list.map((i) => i.title);

describe('the To-do tab', () => {
  test('shows newest added first by default, the summary line last', () => {
    expect(titles(shownTodos(todos, DEFAULT_VIEW, order, now))).toEqual([
      'Put the bins out', 'Return library books', 'Water bill', 'Fix the porch light', 'Pack a phone charger', 'Heartworm chew', 'Change HVAC filter', 'Renew registration',
      'Groceries: 6 on the list',
    ]);
  });

  test('sorts oldest first, by due date (undated last) and by app in the household order', () => {
    expect(titles(shownTodos(todos, { ...DEFAULT_VIEW, sort: 'oldest' }, order, now)).slice(0, 3)).toEqual(['Renew registration', 'Change HVAC filter', 'Heartworm chew']);
    expect(titles(shownTodos(todos, { ...DEFAULT_VIEW, sort: 'due' }, order, now))).toEqual([
      'Change HVAC filter', 'Put the bins out', 'Heartworm chew', 'Return library books', 'Water bill', 'Renew registration', 'Fix the porch light', 'Pack a phone charger',
      'Groceries: 6 on the list',
    ]);
    expect(shownTodos(todos, { ...DEFAULT_VIEW, sort: 'app' }, order, now).map((i) => i.app)).toEqual([
      'tasks', 'tasks', 'home', 'home', 'pet', 'baby', 'car', 'bills', 'groceries',
    ]);
  });

  test('filters by app and to things added over 30 days ago', () => {
    expect(titles(shownTodos(todos, { ...DEFAULT_VIEW, app: 'home' }, order, now))).toEqual(['Put the bins out', 'Change HVAC filter']);
    expect(titles(shownTodos(todos, { ...DEFAULT_VIEW, old: true }, order, now))).toEqual([
      'Fix the porch light', 'Pack a phone charger', 'Heartworm chew', 'Change HVAC filter', 'Renew registration',
    ]);
    expect(appsWithTodos(todos, order)).toEqual(['tasks', 'home', 'pet', 'baby', 'car', 'bills', 'groceries']);
  });

  test('says how much there is, not counting summary lines', () => {
    expect(summaryLine(todos, now)).toBe('8 things to do · 5 added over 30 days ago');
    expect(summaryLine(todos.slice(1, 2), now)).toBe('1 thing to do');
    expect(summaryLine([], now)).toBe('Nothing to do in any app.');
  });

  test('bulk select offers only what the person may cancel', () => {
    expect(cancellable(todos, 'member', 'sam@example.com')).toHaveLength(8);
    // Jo, a helper: their own library books, and skipping the bins (open to everyone).
    expect(titles(cancellable(helperTodos(), 'helper', 'jo@example.com'))).toEqual(['Return library books', 'Put the bins out']);
    expect(cancellable(todos, null, undefined)).toEqual([]);
  });

  test('toasts say what happened in the app’s own words', () => {
    expect(actedLine('Done', 'Fix the porch light')).toBe('Done: Fix the porch light');
    expect(actedLine('Pause', 'Change HVAC filter')).toBe('Paused: Change HVAC filter');
    expect(actedLine('Mark paid', 'Water bill')).toBe('Marked paid: Water bill');
    expect(actedLine('Snooze', 'X')).toBe('Snooze: X');
    expect(bulkLine(1)).toBe('Cancelled 1 thing.');
    expect(bulkLine(5)).toBe('Cancelled 5 things.');
  });
});
