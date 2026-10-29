'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type Ref,
} from 'react';
import { worldLayers } from '@/config/world-layers.generated';
import {
  NEARNESS,
  perspectiveScale,
  type Camera,
  type WorldKind,
  type WorldSceneId,
} from '@/lib/scene/world';
import { createWorldGL, type WorldGL } from '@/lib/world-gl/renderer';
import { Stage, StageLayer } from './Stage';
import { calmMotion } from './timing';

// The meadow and the river as one place: both paintings cut into depth layers
// (scripts/design/build_world.py), stacked so the river's nearer layers sit
// behind the meadow's but in front of its backdrop. The camera moves forward by
// scaling each layer about its scene's vanishing point, the nearer ones faster
// (lib/scene/world.ts). The scenes' own windows, folders and cursors live in
// their scene roots, above this.
//
// Drawn with WebGL where it can be (lib/world-gl): the same layers, with wind in
// the plants, the river moving, mist the camera travels through and light for the
// cut from the monitor. The DOM layers below are the fallback (no WebGL, a lost
// context) and what shows until the GPU has the pictures.

export type WorldPose = {
  camera: Camera;
  /** Which scenes' layers are drawn. */
  show: readonly WorldSceneId[];
  /** Opacity of the meadow's sky and far hills (they give way to the river's). */
  backdrop?: number;
  /** Opacity of the river's mid, near and fore layers (they come up from the distance). */
  front?: number;
  /** Opacity of the meadow's mid, near and fore layers (they give way to the river's). */
  meadow?: number;
  /** Thick mist, 0..1 (WebGL only). */
  fog?: number;
  /** Light flooding the view, 0..1 (WebGL only). */
  light?: number;
  /** How far behind the scenery's camera the mist's is (WebGL only). */
  mistLag?: number;
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
const SWAY: Partial<
  Record<WorldKind, { deg: number; x: number; secs: number }>
> = {
  mid: { deg: 0.12, x: 1, secs: 12 },
  near: { deg: 0.22, x: 2, secs: 9 },
  fore: { deg: 0.34, x: 3, secs: 7.5 },
};
const swayStyle = (
  scene: WorldSceneId,
  kind: WorldKind,
): CSSProperties | undefined => {
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
/** Each painting's water, for the WebGL ripples (scripts/design/build_water_mask.py). */
const WATER_MASK = {
  journey: '/img/world/j_water-v4.png',
  wedding: '/img/world/w_water-v4.png',
};
/** The soap bubble in the journey's sky (centre at 420, 160 and radius 40 in the 1920 x 1080 painting). */
const JOURNEY_BUBBLE = {
  x: (420 / 1920) * 100,
  y: (160 / 1080) * 100,
  r: (40 / 1080) * 100,
};
const REST: WorldPose = { camera: { journey: 0, wedding: 0 }, show: [] };

export function WorldScene({ ref }: { ref?: Ref<WorldHandle> }) {
  const els = useRef(new Map<string, HTMLDivElement>());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const gl = useRef<WorldGL | null>(null);
  const last = useRef<WorldPose>(REST);
  const calm = useRef(false);

  function domPose({
    camera,
    show,
    backdrop = 1,
    front = 1,
    meadow = 1,
  }: WorldPose) {
    for (const [scene, kind] of ORDER) {
      const el = els.current.get(key(scene, kind));
      if (!el) continue;
      const scale = perspectiveScale(NEARNESS[kind], camera[scene]);
      let opacity = 1;
      if (scene === 'journey' && (kind === 'sky' || kind === 'far'))
        opacity = backdrop;
      if (scene === 'wedding' && kind !== 'sky' && kind !== 'far')
        opacity = front;
      if (scene === 'journey' && kind !== 'sky' && kind !== 'far')
        opacity = meadow;
      const on = show.includes(scene) && opacity > 0.002 && scale < GONE;
      el.style.visibility = on ? 'visible' : 'hidden';
      if (!on) continue;
      el.style.transform = `scale(${scale.toFixed(4)})`;
      el.style.opacity = opacity >= 0.998 ? '' : opacity.toFixed(3);
    }
  }

  function pose(pose: WorldPose) {
    // the calm version: the camera stays where it is and the scenes dissolve into each other
    // through the mist and the light
    const p = calm.current
      ? { ...pose, camera: { journey: 0, wedding: 0 }, mistLag: 0 }
      : pose;
    last.current = p;
    if (gl.current) gl.current.pose(p);
    else domPose(p);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    calm.current = calmMotion();
    const renderer = createWorldGL(canvas, {
      scenes: {
        journey: {
          vp: worldLayers.journey.vp,
          layers: worldLayers.journey.layers,
          water: WATER_MASK.journey,
          bubble: JOURNEY_BUBBLE,
        },
        wedding: {
          vp: worldLayers.wedding.vp,
          layers: worldLayers.wedding.layers,
          water: WATER_MASK.wedding,
        },
      },
      stageRect: () => {
        const s = measureRef.current?.getBoundingClientRect();
        const c = canvas.getBoundingClientRect();
        return s
          ? {
              left: s.left - c.left,
              top: s.top - c.top,
              width: s.width,
              height: s.height,
            }
          : { left: 0, top: 0, width: c.width, height: c.height };
      },
      maxDpr: 1.5,
      lite: matchMedia('(pointer: coarse)').matches,
      calm: calmMotion(),
      // the GPU gave up (driver reset, memory): back to the DOM layers
      onLost: () => {
        gl.current = null;
        canvas.style.visibility = 'hidden';
        domPose(last.current);
      },
    });
    if (!renderer) return;
    let alive = true;
    void renderer.ready.then((ok) => {
      if (!alive) return;
      if (!ok) {
        renderer.destroy();
        return;
      }
      gl.current = renderer;
      renderer.pose(last.current);
      canvas.style.visibility = 'visible';
      // the canvas has the scenery now: hide the DOM copy
      domPose({ ...last.current, show: [] });
    });
    return () => {
      alive = false;
      renderer.destroy();
      if (gl.current === renderer) gl.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    pose,
    rest: (scene) =>
      pose({ camera: { journey: 0, wedding: 0 }, show: scene ? [scene] : [] }),
  }));

  return (
    <>
      <Stage>
        <div ref={measureRef} aria-hidden="true" className="absolute inset-0" />
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
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="world-gl"
        style={{ visibility: 'hidden' }}
      />
    </>
  );
}
