// GLSL for the world renderer (renderer.ts). GLSL ES 1.0, so it runs on WebGL 1 and 2.
// Noise comes from a small random texture (u_noise, 256 x 256, repeating, linear): an
// fbm is four lookups, cheap enough for every layer on a phone.

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

const NOISE = `
uniform sampler2D u_noise;
float n1(vec2 p) {
  return texture2D(u_noise, p / 256.0).r;
}
float fbm2(vec2 p) {
  return (n1(p) + 0.5 * n1(p * 2.03 + vec2(17.1, 9.3))) / 1.5;
}
float fbm(vec2 p) {
  return (n1(p) + 0.5 * n1(p * 2.03 + vec2(17.1, 9.3)) + 0.25 * n1(p * 4.1 + vec2(3.7, 41.0))) / 1.75;
}
`;

/** A quad placed in device pixels (u_rect: left, top, right, bottom), y down like CSS. */
export const QUAD_VS = `
attribute vec2 a_pos;
uniform vec4 u_rect;
uniform vec4 u_uv;
uniform vec2 u_canvas;
varying vec2 v_uv;
void main() {
  vec2 p = mix(u_rect.xy, u_rect.zw, a_pos);
  v_uv = mix(u_uv.xy, u_uv.zw, a_pos);
  gl_Position = vec4(p.x / u_canvas.x * 2.0 - 1.0, 1.0 - p.y / u_canvas.y * 2.0, 0.0, 1.0);
}
`;

/**
 * One depth layer of a painting. Everything is worked out in the painting's own frame
 * (st: 0..1 across the stage), so the effects stay put on the scenery while the camera
 * scales the layer.
 * - wind: plants sway (more towards their tips, higher up the frame) in gusts that travel
 *   across the scene, with a finer flutter on top; never on the water
 * - waves: light rolls across the grass as the wind bends it (only on green, below the horizon)
 * - shadow: cloud shadows drift over the ground, in perspective
 * - drift: the sky creeps sideways and its clouds slowly change shape
 * - water: the river ripples (perspective-correct, flowing towards the viewer) and sparkles
 */
export const LAYER_FS = `${PRECISION}
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform sampler2D u_water;
${NOISE}
uniform vec4 u_box;
uniform vec2 u_vp;
uniform float u_time;
uniform float u_opacity;
uniform float u_wind;
uniform float u_windTop;
uniform float u_waves;
uniform float u_shadow;
uniform float u_drift;
uniform float u_hasWater;
uniform float u_paintFade;
uniform vec4 u_paint;
uniform float u_cutout;

void main() {
  vec2 st = u_box.xy + v_uv * u_box.zw;
  float t = u_time;
  vec2 off = vec2(0.0);

  // past its edges a layer fades out rather than showing smeared or mirrored pixels; the
  // plants nearest the lens also fade past the painting's own edges (their padding is a
  // mirror image, which shows when the camera is a step back)
  float edge = smoothstep(-0.08, 0.0, v_uv.x) * smoothstep(1.08, 1.0, v_uv.x)
    * smoothstep(-0.08, 0.0, v_uv.y) * smoothstep(1.08, 1.0, v_uv.y);
  if (u_paintFade > 0.5) {
    edge *= smoothstep(u_paint.x - 0.06, u_paint.x, st.x) * smoothstep(u_paint.z + 0.06, u_paint.z, st.x)
      * smoothstep(u_paint.y - 0.08, u_paint.y, st.y);
  }
  if (edge * u_opacity < 0.002) discard;
  // nothing here, even a few pixels away (a blurry look through the mipmaps): skip the work
  if (u_cutout > 0.5 && texture2D(u_tex, 1.0 - abs(1.0 - abs(v_uv)), 3.0).a < 0.003) discard;

  float water = 0.0;
  if (u_hasWater > 0.5) {
    water = texture2D(u_water, clamp(st, 0.0, 1.0)).r;
  }

  if (u_drift > 0.0) {
    off.x += u_drift * sin(t * 0.021);
    off += u_drift * 0.35 * (vec2(fbm2(st * vec2(24.0, 40.0) + t * 0.06), fbm2(st * vec2(24.0, 40.0) - t * 0.05 + 40.0)) - 0.5);
  }

  if (u_wind > 0.0) {
    float h = mix(1.0, smoothstep(1.02, 0.12, st.y), u_windTop);
    float gust = 0.55 + 0.45 * sin(t * 0.43 + st.x * 2.3) * sin(t * 0.17 + 1.3);
    float wave = sin(st.x * 9.0 - t * 1.25 + fbm2(st * vec2(30.0, 18.0) + t * 0.12) * 4.0);
    float flutter = fbm2(st * vec2(140.0, 90.0) + vec2(t * 1.6, t * 0.5)) - 0.5;
    float g = (0.65 * wave + 1.1 * flutter) * gust;
    off.x += u_wind * h * g * (1.0 - water);
    off.y += u_wind * 0.3 * h * abs(g) * (1.0 - water);
  }

  vec2 woff = vec2(0.0);
  float ground = 0.0;
  vec2 g2 = vec2(0.0);
  if (st.y > u_vp.y) {
    float d = max(st.y - u_vp.y, 0.006);
    g2 = vec2((st.x - u_vp.x) / d, 1.0 / d);
    ground = 1.0;
  }
  float spark = 0.0;
  if (water > 0.001 && ground > 0.5) {
    float d = max(st.y - u_vp.y, 0.006);
    vec2 flow = vec2(0.0, -t * 0.55);
    vec2 gp = g2 * vec2(0.5, 0.11);
    float n1 = fbm(gp * vec2(10.0, 7.0) + flow);
    float n2 = fbm(gp * vec2(16.0, 11.0) - flow * 0.6 + 31.0);
    woff = vec2(n1 - 0.5, (n2 - 0.5) * 0.35) * 0.06 * d * water;
    // sun glitter: tiny, horizontally stretched points that twinkle as two noises cross
    vec2 s1 = gp * vec2(150.0, 380.0) + vec2(t * 0.7, -t * 2.2);
    vec2 s2 = gp * vec2(110.0, 300.0) + vec2(-t * 0.5, -t * 1.6) + 50.0;
    float sp = texture2D(u_noise, s1 / 256.0).r * texture2D(u_noise, s2 / 256.0).g;
    // glitter gathers where the sun reflects: down the middle of the river, fading to the banks
    float sunPath = exp(-pow((st.x - u_vp.x) / (0.07 + d * 0.5), 2.0));
    spark = smoothstep(0.6, 0.85, sp) * water * smoothstep(0.0, 0.06, d) * (0.25 + 0.75 * sunPath);
  }

  // the quad overhangs the layer a little; past its edge the picture is mirrored
  vec2 uv = v_uv + (off + woff) / u_box.zw;
  uv = 1.0 - abs(1.0 - abs(uv));
  vec4 c = texture2D(u_tex, uv);
  vec3 col = c.a > 0.0 ? c.rgb / c.a : c.rgb;

  if (u_waves > 0.0 && ground > 0.5) {
    float green = smoothstep(0.0, 0.07, col.g - max(col.r, col.b) * 0.95);
    float w = sin(g2.y * 0.9 + g2.x * 0.25 - t * 1.1 + n1(st * 26.0 + t * 0.08) * 3.0);
    col *= 1.0 + u_waves * green * w * (1.0 - water);
  }
  if (u_shadow > 0.0 && ground > 0.5) {
    float s = smoothstep(0.5, 0.72, fbm2(g2 * vec2(0.9, 0.25) + vec2(t * 0.09, 0.0)));
    col *= 1.0 - u_shadow * s * (1.0 - water * 0.5);
  }
  if (spark > 0.0) {
    float lum = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(1.0, 0.99, 0.96), spark * (0.35 + 0.4 * lum));
  }

  gl_FragColor = vec4(col * c.a, c.a) * u_opacity * edge;
}
`;

/**
 * A sheet of mist at some depth (it scales with the camera like the scenery, so the camera
 * passes through it). u_ambient is the thin morning haze that always lies low over the
 * ground; u_fog is the thick mist the moves travel through.
 */
export const FOG_FS = `${PRECISION}
varying vec2 v_uv;
${NOISE}
uniform vec4 u_box;
uniform vec2 u_vp;
uniform float u_time;
uniform float u_ambient;
uniform float u_fog;
uniform float u_seed;
uniform float u_opacity;
uniform vec3 u_color;

void main() {
  vec2 st = u_box.xy + v_uv * u_box.zw;
  float band = exp(-pow((st.y - (u_vp.y + 0.04)) / 0.16, 2.0));
  vec2 e = smoothstep(0.0, 0.12, v_uv) * smoothstep(0.0, 0.12, 1.0 - v_uv);
  if ((u_ambient * band + u_fog) * e.x * e.y * u_opacity < 0.003) discard;
  float n = fbm(st * vec2(5.0, 11.0) + vec2(u_time * 0.035 + u_seed, u_seed * 0.37));
  float m = fbm2(st * vec2(13.0, 26.0) - vec2(u_time * 0.05, 0.0) + u_seed * 3.1);
  float cloud = smoothstep(0.4, 0.78, n * 0.75 + m * 0.35);
  // wisps, not a wall: the thick mist still has gaps the scenery shows through
  float a = u_ambient * band * cloud + u_fog * (0.1 + 0.9 * cloud);
  a = clamp(a * e.x * e.y * u_opacity, 0.0, 0.97);
  gl_FragColor = vec4(u_color * a, a);
}
`;

export const POST_VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * The finished frame: a zoom blur towards the vanishing point while the camera moves fast,
 * light flooding in (u_light, for the cut from the monitor), and a fine film grain so the
 * painted surfaces read more like a photograph.
 */
export const POST_FS = `${PRECISION}
varying vec2 v_uv;
uniform sampler2D u_scene;
uniform vec2 u_vp;
uniform vec2 u_sun;
uniform float u_aspect;
uniform float u_blur;
uniform float u_light;
uniform float u_grain;
uniform float u_time;
uniform vec2 u_res;
uniform sampler2D u_noise;

void main() {
  vec2 dir = v_uv - u_vp;
  vec4 c;
  if (u_blur > 0.0004) {
    c = vec4(0.0);
    for (int i = 0; i < 9; i++) {
      float k = float(i) / 8.0;
      c += texture2D(u_scene, v_uv - dir * u_blur * k);
    }
    c /= 9.0;
  } else {
    c = texture2D(u_scene, v_uv);
  }
  vec3 col = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  if (u_light > 0.0) {
    vec2 r = (v_uv - u_sun) * vec2(u_aspect, 1.0);
    float l = u_light * (0.6 + 0.4 * exp(-dot(r, r) * 2.5));
    col = mix(col, vec3(1.0, 0.975, 0.93), clamp(l, 0.0, 1.0));
  }
  if (u_grain > 0.0) {
    // a random texel per pixel, the pattern jumping 24 times a second (a hash of the pixel
    // position would show as faint diagonal stripes in the sky)
    float f = floor(u_time * 24.0);
    float g = texture2D(u_noise, (gl_FragCoord.xy + vec2(37.0, 91.0) * f) / 256.0).b;
    col += (g - 0.5) * u_grain;
  }
  gl_FragColor = vec4(col * c.a, c.a);
}
`;
