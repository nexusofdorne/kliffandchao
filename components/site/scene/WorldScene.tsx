'use client';

import { useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import { worldLayers } from '@/config/world-layers.generated';
import {
  NEARNESS,
  perspectiveScale,
  type Camera,
  type WorldKind,
  type WorldSceneId,
} from '@/lib/scene/world';
import { Stage, StageLayer } from './Stage';

// The meadow and the river as one place: both paintings cut into depth layers
// (scripts/design/build_world.py), stacked so the river's nearer layers sit
// behind the meadow's but in front of its backdrop. The camera moves forward by
// scaling each layer about its scene's vanishing point, the nearer ones faster
// (lib/scene/world.ts). The scenes' own windows, folders and cursors live in
// their scene roots, above this.

export type WorldPose = {
  camera: Camera;
  /** Which scenes' layers are drawn. */
  show: readonly WorldSceneId[];
  /** Opacity of the meadow's sky and far hills (they give way to the river's). */
  backdrop?: number;
  /** Opacity of the river's mid, near and fore layers (they come up from the distance). */
  front?: number;
};

export type WorldHandle = {
  pose: (pose: WorldPose) => void;
  /** One scene at rest (the painting as drawn), or none. */
  rest: (scene: WorldSceneId | null) => void;
};

// back to front: the river's sky and hills sit under the meadow's, which give way to them
const ORDER: readonly (readonly [WorldSceneId, WorldKind])[] = [
  ['wedding', 'sky'],
  ['wedding', 'far'],
  ['journey', 'sky'],
  ['journey', 'far'],
  ['wedding', 'mid'],
  ['wedding', 'near'],
  ['wedding', 'fore'],
  ['wedding', 'glint'],
  ['journey', 'mid'],
  ['journey', 'near'],
  ['journey', 'fore'],
];

// How far each layer's plants sway (a slow, small tilt about the bottom of the frame),
// and how long a sway takes. The nearer, the more; the delays keep the layers out of step.
const SWAY: Partial<Record<WorldKind, { deg: number; x: number; secs: number }>> = {
  mid: { deg: 0.12, x: 1, secs: 12 },
  near: { deg: 0.22, x: 2, secs: 9 },
  fore: { deg: 0.34, x: 3, secs: 7.5 },
};
const swayStyle = (scene: WorldSceneId, kind: WorldKind): CSSProperties | undefined => {
  const s = SWAY[kind];
  if (!s) return undefined;
  const delay = scene === 'journey' ? -2.5 : -6;
  return {
    '--sway': `${s.deg}deg`,
    '--sway-x': `${s.x}px`,
    '--sway-t': `${s.secs}s`,
    '--sway-d': `${delay - s.secs / 3}s`,
  } as CSSProperties;
};

const key = (scene: WorldSceneId, kind: WorldKind) => `${scene}-${kind}`;
// a layer this big has long since passed the lens
const GONE = 14;

export function WorldScene({ ref }: { ref?: Ref<WorldHandle> }) {
  const els = useRef(new Map<string, HTMLDivElement>());

  function pose({ camera, show, backdrop = 1, front = 1 }: WorldPose) {
    for (const [scene, kind] of ORDER) {
      const el = els.current.get(key(scene, kind));
      if (!el) continue;
      const scale = perspectiveScale(NEARNESS[kind], camera[scene]);
      let opacity = 1;
      if (scene === 'journey' && (kind === 'sky' || kind === 'far')) opacity = backdrop;
      if (scene === 'wedding' && kind !== 'sky' && kind !== 'far') opacity = front;
      const on = show.includes(scene) && opacity > 0.002 && scale < GONE;
      el.style.visibility = on ? 'visible' : 'hidden';
      if (!on) continue;
      el.style.transform = `scale(${scale.toFixed(4)})`;
      el.style.opacity = opacity >= 0.998 ? '' : opacity.toFixed(3);
    }
  }

  useImperativeHandle(ref, () => ({
    pose,
    rest: (scene) => pose({ camera: { journey: 0, wedding: 0 }, show: scene ? [scene] : [] }),
  }));

  return (
    <Stage>
      {ORDER.map(([scene, kind]) => {
        const world = worldLayers[scene];
        const layer = world.layers.find((l) => l.kind === kind);
        if (!layer) return null;
        return (
          <div
            key={key(scene, kind)}
            ref={(el) => {
              if (el) els.current.set(key(scene, kind), el);
              else els.current.delete(key(scene, kind));
            }}
            className="world-layer"
            style={{
              transformOrigin: `${world.vp.x}% ${world.vp.y}%`,
              visibility: 'hidden',
            }}
          >
            {kind === 'glint' ? (
              <>
                <div className="world-glint world-glint--a">
                  <StageLayer asset={layer} />
                </div>
                <div className="world-glint world-glint--b">
                  <StageLayer asset={layer} />
                </div>
              </>
            ) : SWAY[kind] ? (
              <div className="world-sway" style={swayStyle(scene, kind)}>
                <StageLayer asset={layer} />
              </div>
            ) : (
              <StageLayer asset={layer} priority={kind === 'sky'} />
            )}
          </div>
        );
      })}
    </Stage>
  );
}
