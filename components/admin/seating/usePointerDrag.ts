'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { resolveDropTarget, type DropTarget } from '@/lib/seating/drag';
import type { Point } from '@/lib/seating/geometry';

// What a press on the page can turn into. clickTableId: the table a press without a drag selects.
export type Gesture =
  | { kind: 'table'; tableId: string; origin: Point; clickTableId: string }
  | { kind: 'center'; origin: Point; clickTableId?: string }
  | { kind: 'guest'; guestIds: string[]; household: boolean; label: string; clickTableId?: string }
  | { kind: 'click'; clickTableId: string };

export type ActiveDrag = {
  gesture: Gesture;
  delta: Point; // pointer travel in floor-plan units, for tables and the center
  client: Point; // pointer position on screen, for a guest's floating name tag
  target: DropTarget; // what a guest would land on
};

// A press only becomes a drag past this many screen pixels; less is a click.
const DRAG_THRESHOLD = 4;

function toFloor(svg: SVGSVGElement | null, x: number, y: number): Point {
  const ctm = svg?.getScreenCTM();
  if (!ctm) return { x, y };
  const p = new DOMPoint(x, y).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

// Pointer-event dragging with no library: listeners go on the window for the length of one press.
// onEnd gets the finished drag, or null when the press was a click.
export function usePointerDrag(
  svgRef: RefObject<SVGSVGElement | null>,
  onEnd: (gesture: Gesture, drag: ActiveDrag | null) => void,
) {
  const [active, setActive] = useState<ActiveDrag | null>(null);
  const onEndRef = useRef(onEnd);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onEndRef.current = onEnd;
  });
  useEffect(() => () => stopRef.current?.(), []);

  function begin(event: ReactPointerEvent, gesture: Gesture) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopRef.current?.();

    const start = { x: event.clientX, y: event.clientY };
    const startFloor = toFloor(svgRef.current, start.x, start.y);
    let drag: ActiveDrag | null = null;

    const move = (e: PointerEvent) => {
      if (!drag && Math.hypot(e.clientX - start.x, e.clientY - start.y) < DRAG_THRESHOLD) return;
      const floor = toFloor(svgRef.current, e.clientX, e.clientY);
      drag = {
        gesture,
        delta: { x: floor.x - startFloor.x, y: floor.y - startFloor.y },
        client: { x: e.clientX, y: e.clientY },
        target: gesture.kind === 'guest' ? resolveDropTarget(document.elementFromPoint(e.clientX, e.clientY)) : null,
      };
      setActive(drag);
    };
    const up = () => {
      stop();
      onEndRef.current(gesture, drag);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', stop);
      stopRef.current = null;
      setActive(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', stop);
    stopRef.current = stop;
  }

  return { active, begin };
}
