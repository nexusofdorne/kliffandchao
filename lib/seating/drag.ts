// Drop targets on the seating page are marked in the DOM: data-drop-seat="<tableId>:<seat>" on a
// chair, data-drop-table="<tableId>" on a table body, data-drop-unseat on the not-seated list.
// The page finds the element under the pointer (document.elementFromPoint) and asks this.

export type DropTarget =
  | { kind: 'chair'; tableId: string; seat: number }
  | { kind: 'table'; tableId: string }
  | { kind: 'unseat' }
  | null;

function chairTarget(value: string): DropTarget {
  const split = value.lastIndexOf(':');
  const tableId = value.slice(0, split);
  const seat = Number(value.slice(split + 1));
  if (split < 1 || !Number.isInteger(seat) || seat < 1) return null;
  return { kind: 'chair', tableId, seat };
}

// The nearest marked element at or above `el` wins, so a chair drawn inside its table is a chair.
export function resolveDropTarget(el: Element | null): DropTarget {
  for (let node = el; node; node = node.parentElement) {
    const seat = node.getAttribute('data-drop-seat');
    if (seat !== null) return chairTarget(seat);
    const table = node.getAttribute('data-drop-table');
    if (table) return { kind: 'table', tableId: table };
    if (node.getAttribute('data-drop-unseat') !== null) return { kind: 'unseat' };
  }
  return null;
}
