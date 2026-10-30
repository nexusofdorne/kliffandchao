import { describe, expect, it } from 'vitest';
import { resolveDropTarget } from './drag';

// The unit tests run in node, with no DOM: a stand-in with just what resolveDropTarget reads.
function fakeElement(attributes: Record<string, string>, parent: Element | null = null): Element {
  return {
    getAttribute: (name: string) => attributes[name] ?? null,
    parentElement: parent,
  } as unknown as Element;
}

describe('resolveDropTarget', () => {
  it('reads a chair as its table and seat', () => {
    expect(resolveDropTarget(fakeElement({ 'data-drop-seat': 'table-1:7' }))).toEqual({
      kind: 'chair',
      tableId: 'table-1',
      seat: 7,
    });
  });

  it('reads a table body as the table', () => {
    expect(resolveDropTarget(fakeElement({ 'data-drop-table': 'table-2' }))).toEqual({
      kind: 'table',
      tableId: 'table-2',
    });
  });

  it('finds the nearest target above a nested child, so a chair inside a table wins', () => {
    const table = fakeElement({ 'data-drop-table': 'table-3' });
    const chair = fakeElement({ 'data-drop-seat': 'table-3:2' }, table);
    const label = fakeElement({}, chair);
    expect(resolveDropTarget(label)).toEqual({ kind: 'chair', tableId: 'table-3', seat: 2 });
    expect(resolveDropTarget(fakeElement({}, table))).toEqual({ kind: 'table', tableId: 'table-3' });
  });

  it('reads the not-seated list as unseat', () => {
    const list = fakeElement({ 'data-drop-unseat': '' });
    expect(resolveDropTarget(fakeElement({}, list))).toEqual({ kind: 'unseat' });
  });

  it('returns null for an unrelated element, nothing, or a malformed chair', () => {
    expect(resolveDropTarget(fakeElement({}, fakeElement({})))).toBeNull();
    expect(resolveDropTarget(null)).toBeNull();
    expect(resolveDropTarget(fakeElement({ 'data-drop-seat': 'table-1:x' }))).toBeNull();
    expect(resolveDropTarget(fakeElement({ 'data-drop-seat': ':3' }))).toBeNull();
  });
});
