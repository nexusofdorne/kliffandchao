'use client';

import { useEffect, useRef } from 'react';

// ~16% of a card: deliberate, not a jiggle.
const DRAG_THRESHOLD_PX = 64;
// Covers the smooth-scroll a jump triggers, so a fast flick can't queue
// several jumps before the first one lands.
const JUMP_LOCK_MS = 430;

// Desktop-only drag + horizontal-wheel gestures over the coverflow, both
// landing on the same `onStep` as the chapter dots and prev/next arrows —
// prototype/index.html's pointerdown/pointermove/wheel handlers on `.flow`.
// Mobile uses native scroll-snap instead (no gesture code needed there).
export function useCoverflowGestures(enabled: boolean, onStep: (direction: 1 | -1) => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onStepRef = useRef(onStep);
  // Exposed so card click handlers can ignore the click a drag-release
  // fires right after it — prototype's `swiped` flag.
  const justSwipedRef = useRef(false);

  useEffect(() => {
    onStepRef.current = onStep;
  }, [onStep]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    let lockUntil = 0;
    let dragFromX: number | null = null;
    let dragging = false;

    function step(direction: 1 | -1) {
      if (performance.now() < lockUntil) return;
      lockUntil = performance.now() + JUMP_LOCK_MS;
      onStepRef.current(direction);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragFromX = event.clientX;
      dragging = true;
      justSwipedRef.current = false;
    }

    function handlePointerMove(event: PointerEvent) {
      if (!dragging || dragFromX === null) return;
      const dx = event.clientX - dragFromX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
        step(dx < 0 ? 1 : -1);
        dragging = false;
        justSwipedRef.current = true; // one card per gesture
      }
    }

    function handlePointerUp() {
      dragging = false;
    }

    // Trackpad two-finger horizontal swipe. Only claimed when the gesture is
    // predominantly horizontal, or this would eat the vertical scroll that
    // drives the whole track.
    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      step(event.deltaX > 0 ? 1 : -1);
    }

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [enabled]);

  return { containerRef, justSwipedRef };
}
