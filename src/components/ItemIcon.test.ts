import { describe, expect, it } from 'bun:test';
import { itemMeta } from './ItemIcon';

describe('item meta line', () => {
  it('shows who and the detail', () => {
    expect(itemMeta({ title: 'Yearly checkup', who: 'Biscuit', detail: 'Example Animal Hospital' })).toBe('Biscuit · Example Animal Hospital');
  });

  it("leaves out who when the title already names them, whatever the case", () => {
    expect(itemMeta({ title: "Biscuit's breakfast", who: 'biscuit', detail: '1 cup dry food' })).toBe('1 cup dry food');
    expect(itemMeta({ title: 'Feed Biscuit', who: 'Biscuit' })).toBe('');
  });

  it('is empty with neither', () => {
    expect(itemMeta({ title: 'Gutter cleaning' })).toBe('');
  });
});
