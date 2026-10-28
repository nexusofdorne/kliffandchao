'use client';

import type { Ref } from 'react';

// Warm light over the whole screen: the monitor's film flares as the camera pushes
// into it, the light floods the view, and the meadow comes up out of it (its mist and
// light are drawn by the world). transitions.ts drives its opacity.
export function LightVeil({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return <div ref={ref} aria-hidden="true" className="light-veil" />;
}
