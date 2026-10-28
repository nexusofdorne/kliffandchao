// The meadow and the river drawn with WebGL: the same depth layers and camera as the
// DOM version (lib/scene/world.ts), with the scenery brought to life in the shaders
// (wind in the plants and grass, cloud shadows, the river rippling and sparkling, the
// sky creeping), sheets of mist at three depths that the camera passes through, a zoom
// blur while it moves fast, and light flooding in for the cut from the monitor.
//
// Framework-free: the site's WorldScene and the phone design (bundled by
// scripts/design/publish-phone.ts) both drive it through pose(). If WebGL is missing,
// or the context is lost, the caller keeps (or goes back to) the DOM layers.

import { NEARNESS, perspectiveScale } from '../scene/world';
import { FOG_FS, LAYER_FS, POST_FS, POST_VS, QUAD_VS } from './shaders';

export type SceneId = 'journey' | 'wedding';
/** A box in % of the stage, as in the generated layer lists. */
export type Box = { x: number; y: number; w: number; h: number };
export type LayerDef = Box & { kind: string; src: string };
export type SceneDef = {
  vp: { x: number; y: number };
  layers: readonly LayerDef[];
  /** A greyscale mask of the water, covering the whole stage. */
  water?: string;
  /** Where the painting itself is, in % of the stage (outside it the layers' padding is a mirror
   *  image). The whole stage unless the stage is a crop of a wider painting (the phone). */
  paint?: Box;
};
/** Where the stage sits, in CSS px relative to the canvas. */
export type StageRect = { left: number; top: number; width: number; height: number };

export type WorldGLPose = {
  camera: Record<SceneId, number>;
  show: readonly SceneId[];
  /** Opacity of the meadow's sky and far hills (they give way to the river's). */
  backdrop?: number;
  /** Opacity of the river's mid, near and fore layers. */
  front?: number;
  /** Opacity of the meadow's mid, near and fore layers. */
  meadow?: number;
  /** Thick mist, 0..1 (the moves travel through it). */
  fog?: number;
  /** Light flooding the view, 0..1. */
  light?: number;
  /** How far behind the scenery's camera the mist's is (it streams past while this closes). */
  mistLag?: number;
};

export type WorldGLOptions = {
  scenes: Record<SceneId, SceneDef>;
  stageRect: () => StageRect;
  /** Caps the drawing resolution (device px per CSS px). */
  maxDpr?: number;
  /** A phone: fewer frames and a lower resolution. */
  lite?: boolean;
  /** The most pixels the scenery is drawn at (the finished frame is scaled up to the canvas). */
  maxPixels?: number;
  /** The scenery holds still. */
  still?: boolean;
  /** "Reduce motion" is on: the scenery moves at half speed and the camera's blur is off. */
  calm?: boolean;
  onLost?: () => void;
};

export type WorldGL = {
  /** Resolves true once every picture is on the GPU, false if anything failed. */
  ready: Promise<boolean>;
  pose: (pose: WorldGLPose) => void;
  destroy: () => void;
};

type Kind = 'sky' | 'far' | 'mid' | 'near' | 'fore';
type FogKind = 'fog1' | 'fog2' | 'fog3';
type Item = readonly [SceneId, Kind | FogKind];

// back to front, as in WorldScene, with a sheet of mist between the depths
const ORDER: readonly Item[] = [
  ['wedding', 'sky'],
  ['wedding', 'far'],
  ['wedding', 'fog1'],
  ['journey', 'sky'],
  ['journey', 'far'],
  ['journey', 'fog1'],
  ['wedding', 'mid'],
  ['wedding', 'fog2'],
  ['wedding', 'near'],
  ['wedding', 'fog3'],
  ['wedding', 'fore'],
  ['journey', 'mid'],
  ['journey', 'fog2'],
  ['journey', 'near'],
  ['journey', 'fog3'],
  ['journey', 'fore'],
];
const FOG_NEARNESS: Record<FogKind, number> = { fog1: 0.4, fog2: 0.74, fog3: 0.86 };
const FOG_SEED: Record<FogKind, number> = { fog1: 11, fog2: 47, fog3: 83 };
// a sheet of mist overhangs the stage, so its soft edge stays out of sight as it scales
const FOG_BOX: Box = { x: -30, y: -30, w: 160, h: 160 };

// how much each depth is moved by the wind, the light rolling over the grass, cloud
// shadows and the sky's drift (wind and drift in stage widths)
const EFFECTS: Record<Kind, { wind: number; windTop: number; waves: number; shadow: number; drift: number }> = {
  sky: { wind: 0, windTop: 0, waves: 0, shadow: 0, drift: 0.006 },
  far: { wind: 0, windTop: 0, waves: 0, shadow: 0.06, drift: 0 },
  mid: { wind: 0.0006, windTop: 0, waves: 0.05, shadow: 0.08, drift: 0 },
  near: { wind: 0.0016, windTop: 1, waves: 0.045, shadow: 0.08, drift: 0 },
  fore: { wind: 0.003, windTop: 1, waves: 0, shadow: 0.05, drift: 0 },
};
const AMBIENT_FOG = 0.22;
const OVERHANG = 0.08;
const GONE = 14;
const GRAIN = 0.022;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function compile(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('world-gl: shader', gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'a_pos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('world-gl: link', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function uniforms(gl: WebGLRenderingContext, program: WebGLProgram, names: readonly string[]) {
  return Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)])) as Record<
    string,
    WebGLUniformLocation | null
  >;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`world-gl: could not load ${src}`));
    img.src = src;
  });
}

export function createWorldGL(canvas: HTMLCanvasElement, options: WorldGLOptions): WorldGL | null {
  const attrs: WebGLContextAttributes = {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: options.lite ? 'low-power' : 'high-performance',
  };
  const gl2 = canvas.getContext('webgl2', attrs) as WebGL2RenderingContext | null;
  const gl = (gl2 ?? canvas.getContext('webgl', attrs)) as WebGLRenderingContext | null;
  if (!gl) return null;
  const isGL2 = !!gl2;

  const layerProgram = compile(gl, QUAD_VS, LAYER_FS);
  const fogProgram = compile(gl, QUAD_VS, FOG_FS);
  const postProgram = compile(gl, POST_VS, POST_FS);
  if (!layerProgram || !fogProgram || !postProgram) return null;
  const lu = uniforms(gl, layerProgram, [
    'u_rect', 'u_uv', 'u_canvas', 'u_tex', 'u_water', 'u_noise', 'u_box', 'u_vp', 'u_time', 'u_opacity',
    'u_wind', 'u_windTop', 'u_waves', 'u_shadow', 'u_drift', 'u_hasWater', 'u_paintFade', 'u_paint', 'u_cutout',
  ]);
  const fu = uniforms(gl, fogProgram, [
    'u_rect', 'u_uv', 'u_canvas', 'u_noise', 'u_box', 'u_vp', 'u_time', 'u_ambient', 'u_fog', 'u_seed', 'u_opacity', 'u_color',
  ]);
  const pu = uniforms(gl, postProgram, [
    'u_scene', 'u_vp', 'u_sun', 'u_aspect', 'u_blur', 'u_light', 'u_grain', 'u_time', 'u_res', 'u_noise',
  ]);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // a repeating random texture: the shaders' noise
  const noise = gl.createTexture();
  {
    const size = 256;
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 256) | 0;
    gl.bindTexture(gl.TEXTURE_2D, noise);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  function upload(img: HTMLImageElement, mipmaps: boolean): WebGLTexture | null {
    const tex = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
    gl!.pixelStorei(gl!.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    if (mipmaps && isGL2) {
      gl!.generateMipmap(gl!.TEXTURE_2D);
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR_MIPMAP_LINEAR);
    } else {
      gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    }
    return tex;
  }

  // the pictures
  const textures = new Map<string, WebGLTexture | null>();
  const water: Partial<Record<SceneId, WebGLTexture | null>> = {};
  const jobs: Promise<void>[] = [];
  (Object.keys(options.scenes) as SceneId[]).forEach((scene) => {
    const def = options.scenes[scene];
    for (const layer of def.layers) {
      if (!(layer.kind in EFFECTS)) continue;
      jobs.push(loadImage(layer.src).then((img) => void textures.set(`${scene}-${layer.kind}`, upload(img, true))));
    }
    if (def.water) {
      jobs.push(loadImage(def.water).then((img) => void (water[scene] = upload(img, false))));
    }
  });

  // the frame the layers are drawn into, before the blur and the light
  let fbo: WebGLFramebuffer | null = null;
  let fboTex: WebGLTexture | null = null;
  let fboW = 0;
  let fboH = 0;
  function sizeTarget(w: number, h: number) {
    if (w === fboW && h === fboH && fbo) return;
    fboW = w;
    fboH = h;
    if (fboTex) gl!.deleteTexture(fboTex);
    if (fbo) gl!.deleteFramebuffer(fbo);
    fboTex = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, fboTex);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    fbo = gl!.createFramebuffer();
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, fboTex, 0);
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
  }

  let current: Required<WorldGLPose> = {
    camera: { journey: 0, wedding: 0 },
    show: [],
    backdrop: 1,
    front: 1,
    meadow: 1,
    fog: 0,
    light: 0,
    mistLag: 0,
  };
  // the zoom blur follows how fast the camera is moving
  let lastPoseAt = 0;
  let speed = 0;
  let blur = 0;
  let loaded = false;
  let lost = false;
  let raf = 0;
  let lastFrame = 0;
  const t0 = performance.now();
  const stillTime = 37.0;

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, options.maxDpr ?? 1.5);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return dpr;
  }

  function render(now: number) {
    if (lost || !loaded) return;
    const dpr = size();
    const W = canvas.width;
    const H = canvas.height;
    const k = Math.min(1, Math.sqrt((options.maxPixels ?? 1.4e6) / (W * H)));
    const fw = Math.max(1, Math.round(W * k));
    const fh = Math.max(1, Math.round(H * k));
    sizeTarget(fw, fh);
    const S = options.stageRect();
    const sl = S.left * dpr;
    const stp = S.top * dpr;
    const sw = S.width * dpr;
    const sh = S.height * dpr;
    const t = options.still ? stillTime : (((now - t0) / 1000) * (options.calm ? 0.5 : 1)) % 3600;

    // the camera's speed eases off when the poses stop coming
    if (now - lastPoseAt > 120) speed = 0;
    blur += (Math.min(0.07, speed * 0.075) - blur) * 0.2;

    gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbo);
    gl!.viewport(0, 0, fw, fh);
    gl!.disable(gl!.SCISSOR_TEST);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);

    for (const [scene, kind] of ORDER) {
      if (!current.show.includes(scene)) continue;
      const def = options.scenes[scene];
      const isFog = kind.startsWith('fog');
      const nearness = isFog ? FOG_NEARNESS[kind as FogKind] : NEARNESS[kind as Kind];
      const scale = perspectiveScale(nearness, current.camera[scene] - (isFog ? current.mistLag : 0));
      if (scale >= GONE) continue;
      let opacity = 1;
      if (scene === 'journey' && (kind === 'sky' || kind === 'far' || kind === 'fog1')) opacity = current.backdrop;
      if (scene === 'wedding' && kind !== 'sky' && kind !== 'far' && kind !== 'fog1') opacity = current.front;
      if (scene === 'journey' && kind !== 'sky' && kind !== 'far' && kind !== 'fog1') opacity = current.meadow;
      if (opacity <= 0.002) continue;

      const layer = isFog ? FOG_BOX : def.layers.find((l) => l.kind === kind);
      if (!layer) continue;
      // a layer's quad overhangs it (mirrored in the shader), so a layer that shrinks a little
      // (the camera a step back) or sways never shows its edge
      const mx = isFog ? 0 : OVERHANG;
      const box = { x: layer.x - layer.w * mx, y: layer.y - layer.h * mx, w: layer.w * (1 + 2 * mx), h: layer.h * (1 + 2 * mx) };
      const vx = sl + (sw * def.vp.x) / 100;
      const vy = stp + (sh * def.vp.y) / 100;
      const x0 = vx + (sl + (sw * box.x) / 100 - vx) * scale;
      const y0 = vy + (stp + (sh * box.y) / 100 - vy) * scale;
      const x1 = vx + (sl + (sw * (box.x + box.w)) / 100 - vx) * scale;
      const y1 = vy + (stp + (sh * (box.y + box.h)) / 100 - vy) * scale;
      if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) continue;

      if (isFog) {
        const fogNow = current.fog;
        const ambient = AMBIENT_FOG * (kind === 'fog3' ? 0.5 : 1);
        if (fogNow <= 0.002 && ambient <= 0) continue;
        gl!.useProgram(fogProgram);
        gl!.uniform4f(fu.u_rect, x0, y0, x1, y1);
        gl!.uniform4f(fu.u_uv, 0, 0, 1, 1);
        gl!.uniform2f(fu.u_canvas, W, H);
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, noise);
        gl!.uniform1i(fu.u_noise, 1);
        gl!.uniform4f(fu.u_box, box.x / 100, box.y / 100, box.w / 100, box.h / 100);
        gl!.uniform2f(fu.u_vp, def.vp.x / 100, def.vp.y / 100);
        gl!.uniform1f(fu.u_time, t);
        gl!.uniform1f(fu.u_ambient, ambient);
        gl!.uniform1f(fu.u_fog, fogNow);
        gl!.uniform1f(fu.u_seed, FOG_SEED[kind as FogKind]);
        gl!.uniform1f(fu.u_opacity, opacity);
        const glow = current.light * 0.06;
        gl!.uniform3f(fu.u_color, 0.92 + glow, 0.935 + glow, 0.93 + glow * 0.6);
      } else {
        const tex = textures.get(`${scene}-${kind}`);
        if (!tex) continue;
        const fx = EFFECTS[kind as Kind];
        const motion = options.still ? 0 : 1;
        gl!.useProgram(layerProgram);
        gl!.uniform4f(lu.u_rect, x0, y0, x1, y1);
        gl!.uniform4f(lu.u_uv, -mx, -mx, 1 + mx, 1 + mx);
        gl!.uniform2f(lu.u_canvas, W, H);
        gl!.activeTexture(gl!.TEXTURE0);
        gl!.bindTexture(gl!.TEXTURE_2D, tex);
        gl!.uniform1i(lu.u_tex, 0);
        gl!.activeTexture(gl!.TEXTURE1);
        gl!.bindTexture(gl!.TEXTURE_2D, noise);
        gl!.uniform1i(lu.u_noise, 1);
        const w = water[scene];
        gl!.activeTexture(gl!.TEXTURE2);
        gl!.bindTexture(gl!.TEXTURE_2D, w ?? noise);
        gl!.uniform1i(lu.u_water, 2);
        gl!.uniform1f(lu.u_hasWater, w && kind !== 'sky' ? 1 : 0);
        gl!.uniform4f(lu.u_box, layer.x / 100, layer.y / 100, layer.w / 100, layer.h / 100);
        gl!.uniform2f(lu.u_vp, def.vp.x / 100, def.vp.y / 100);
        gl!.uniform1f(lu.u_time, t);
        gl!.uniform1f(lu.u_opacity, opacity);
        gl!.uniform1f(lu.u_wind, fx.wind * motion);
        gl!.uniform1f(lu.u_windTop, fx.windTop);
        gl!.uniform1f(lu.u_waves, fx.waves * motion);
        gl!.uniform1f(lu.u_shadow, fx.shadow);
        gl!.uniform1f(lu.u_drift, fx.drift * motion);
        gl!.uniform1f(lu.u_paintFade, kind === 'near' || kind === 'fore' ? 1 : 0);
        gl!.uniform1f(lu.u_cutout, kind === 'sky' || !isGL2 ? 0 : 1);
        const paint = def.paint ?? { x: 0, y: 0, w: 100, h: 100 };
        gl!.uniform4f(lu.u_paint, paint.x / 100, paint.y / 100, (paint.x + paint.w) / 100, (paint.y + paint.h) / 100);
      }
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    }

    // to the screen, through the blur and the light; only the stage is drawn
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.viewport(0, 0, W, H);
    gl!.disable(gl!.BLEND);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
    gl!.enable(gl!.SCISSOR_TEST);
    const sx0 = Math.max(0, Math.floor(sl));
    const sy0 = Math.max(0, Math.floor(H - (stp + sh)));
    gl!.scissor(sx0, sy0, Math.min(W, Math.ceil(sl + sw)) - sx0, Math.min(H, Math.ceil(H - stp)) - sy0);
    gl!.useProgram(postProgram);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, fboTex);
    gl!.uniform1i(pu.u_scene, 0);
    gl!.activeTexture(gl!.TEXTURE1);
    gl!.bindTexture(gl!.TEXTURE_2D, noise);
    gl!.uniform1i(pu.u_noise, 1);
    const lead = current.show.includes('wedding') && current.front > 0.5 ? 'wedding' : (current.show[0] ?? 'journey');
    const vp = options.scenes[lead].vp;
    gl!.uniform2f(pu.u_vp, (sl + (sw * vp.x) / 100) / W, 1 - (stp + (sh * vp.y) / 100) / H);
    gl!.uniform2f(pu.u_sun, (sl + sw * 0.5) / W, 1 - (stp + sh * 0.18) / H);
    gl!.uniform1f(pu.u_aspect, W / H);
    gl!.uniform1f(pu.u_blur, options.still || options.calm ? 0 : blur);
    gl!.uniform1f(pu.u_light, current.light);
    gl!.uniform1f(pu.u_grain, GRAIN);
    gl!.uniform1f(pu.u_time, t);
    gl!.uniform2f(pu.u_res, W, H);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
    gl!.disable(gl!.SCISSOR_TEST);
    lastFrame = now;
  }

  function loop(now: number) {
    raf = 0;
    if (lost) return;
    const visible = document.visibilityState === 'visible' && current.show.length > 0;
    if (!visible) return;
    // every frame while the camera moves; at rest the scenery's slow motion needs only 30 a second
    // (fewer on a phone)
    const moving = now - lastPoseAt < 200;
    const interval = moving ? 0 : options.lite ? 40 : 30;
    if (now - lastFrame >= interval) render(now);
    if (!options.still) raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (!raf && !lost) raf = requestAnimationFrame(loop);
  }
  function clear() {
    if (lost) return;
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
    gl!.clearColor(0, 0, 0, 0);
    gl!.clear(gl!.COLOR_BUFFER_BIT);
  }

  const onVisibility = () => kick();
  document.addEventListener('visibilitychange', onVisibility);
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    if (raf) cancelAnimationFrame(raf);
    options.onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  const ready = Promise.all(jobs).then(
    () => {
      loaded = true;
      kick();
      return true;
    },
    (err) => {
      console.warn(err);
      return false;
    },
  );

  return {
    ready,
    pose(p) {
      const now = performance.now();
      const dt = Math.max(1, now - lastPoseAt) / 1000;
      const dc =
        Math.abs(p.camera.journey - current.camera.journey) +
        0.6 * Math.abs(p.camera.wedding - current.camera.wedding) +
        0.25 * Math.abs((p.mistLag ?? 0) - current.mistLag);
      speed = lastPoseAt && now - lastPoseAt < 120 ? dc / dt : 0;
      lastPoseAt = now;
      current = {
        camera: { ...p.camera },
        show: [...p.show],
        backdrop: clamp01(p.backdrop ?? 1),
        front: clamp01(p.front ?? 1),
        meadow: clamp01(p.meadow ?? 1),
        fog: clamp01(p.fog ?? 0),
        light: clamp01(p.light ?? 0),
        mistLag: p.mistLag ?? 0,
      };
      if (current.show.length === 0) {
        clear();
        return;
      }
      if (options.still && loaded) render(now);
      kick();
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lost = true;
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      textures.forEach((t) => t && gl.deleteTexture(t));
      Object.values(water).forEach((t) => t && gl.deleteTexture(t));
      if (fboTex) gl.deleteTexture(fboTex);
      if (fbo) gl.deleteFramebuffer(fbo);
      gl.deleteTexture(noise);
      gl.deleteBuffer(quad);
      gl.deleteProgram(layerProgram);
      gl.deleteProgram(fogProgram);
      gl.deleteProgram(postProgram);
    },
  };
}
