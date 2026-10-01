// Coverflow card maths, extracted from prototype/index.html's paintFlow().
// Pure so the geometry can be unit tested without a browser — Coverflow
// just measures the card width and applies the result.

// Cards beyond this many positions from the active one are parked off-stage
// at zero opacity, not positioned individually — nineteen live cards each
// recomputing a transform every scrub frame would be wasted work.
export const COVERFLOW_VISIBLE_RANGE = 3;
// The gap between card centres, as a multiple of a card's own width.
export const COVERFLOW_STRIDE_RATIO = 1.18;

export type CardTransform = {
  translateX: number;
  scale: number;
  opacity: number;
  zIndex: number;
  isActive: boolean;
};

// offset is this card's index minus the active index — 0 is centred,
// negative is to the left, positive to the right.
export function computeCardTransform(offset: number, cardWidth: number): CardTransform {
  const stride = cardWidth * COVERFLOW_STRIDE_RATIO;
  const distance = Math.abs(offset);

  if (distance > COVERFLOW_VISIBLE_RANGE) {
    return {
      translateX: Math.sign(offset) * stride * COVERFLOW_VISIBLE_RANGE,
      scale: 0.7,
      opacity: 0,
      zIndex: 0,
      isActive: false,
    };
  }

  const isActive = offset === 0;
  return {
    translateX: offset * stride,
    scale: isActive ? 1 : 0.84 - (distance - 1) * 0.06,
    opacity: isActive ? 1 : Math.max(0, 0.62 - (distance - 1) * 0.18),
    zIndex: 50 - distance,
    isActive,
  };
}

// Where a drag/wheel step lands, clamped to the story range — prototype's
// `step()`. The same clamp covers both directions since `direction` is
// always ±1.
export function computeStepTarget(activeIndex: number, direction: 1 | -1, storyCount: number): number {
  return Math.min(storyCount - 1, Math.max(0, activeIndex + direction));
}
