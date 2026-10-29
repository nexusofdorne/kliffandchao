"""Cut the meadow (journey) and the river (wedding) paintings into depth layers.

    python scripts/design/build_world.py [--preview]

Reads the clean paintings from public/img/scenes, estimates depth (world_maps.py),
slices it into a sky and four layers (far, mid, near, fore), and writes
  public/img/world/<j|w>_<kind>.webp   (a few px wider than the frame where the camera
                                        can see past its edge)
  config/world-layers.generated.ts
Every layer is cumulative: it covers everything at its depth and nearer, with the
nearer things replaced by a smooth fill, so when a nearer layer moves aside the
picture behind it is already there. At rest the layers stack back into the painting.
With --preview it also writes a test strip (to WORLD_PREVIEW_DIR) that scales the
layers like the camera does.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
import world_maps as wm  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "img", "world")
W, H = 1920, 1080

def _pts(*xy):
    return [(round(x), round(y)) for x, y in xy]


# The 3.0 paintings (October 2026): the path to the white building (journey) and the hall with the
# round window (wedding). Points are read off the 1920 x 1080 painting.
SCENES = {
    "j": dict(
        name="journey",
        src="public/img/scenes/journey/j00_bg-v4.jpg",
        hy=560,
        vp=(1128, 530),
        # the white building: lifted from the far hills to the middle distance, so it grows as
        # the camera walks up the path (its round arch, with the valley through it, stays far)
        building=dict(box=(590, 268, 1830, 566), arch=((1128, 414), 98)),
        # the two streams beside the path
        water=[
            _pts((1002, 702), (1138, 738), (1138, 768), (1044, 840), (948, 948), (864, 1044), (828, 1080),
                 (516, 1080), (564, 1020), (672, 960), (780, 888), (840, 828), (936, 768), (984, 732)),
            _pts((1458, 768), (1548, 720), (1608, 768), (1560, 840), (1440, 960), (1332, 1080), (1272, 1080),
                 (1380, 960), (1440, 840)),
        ],
    ),
    "w": dict(
        name="wedding",
        src="public/img/scenes/wedding/j05_bg-v4.jpg",
        hy=846,
        vp=(956, 560),
        # the round window: the sky and the lake beyond it are the far distance
        window=((956, 504), 346),
        glint=True,
        # the pool in the floor, and the lake seen through the window
        water=[
            _pts((708, 890), (1212, 890), (1180, 930), (1110, 960), (1200, 1010), (1500, 1060), (1700, 1080),
                 (330, 1080), (450, 1030), (600, 980), (700, 945), (720, 915)),
            _pts((640, 735), (1272, 735), (1250, 800), (1180, 846), (956, 850), (730, 846), (660, 800)),
        ],
    ),
}
# where each layer starts in the depth map, and how far past the frame it is extended
KINDS = [
    ("far", 0.001, (150, 150)),
    ("mid", 0.20, (260, 200)),
    ("near", 0.42, (0, 150)),
    ("fore", 0.62, (0, 150)),
]
# how much of the painting's own fine texture goes back into a layer's fill
DETAIL_GAIN = {"far": 0.3, "mid": 0.8, "near": 0.9, "fore": 0.0}
BAND = 0.05
SKY_PAD = (160, 160)
# a changed picture needs a new name: media is cached for a week as immutable (vercel.json)
REV = "-v4"


def fill_for(orig, valid, detail_gain):
    low = wm.push_pull_fill(orig, valid)
    if detail_gain <= 0:
        return low
    hp = orig - ndi.gaussian_filter(orig, (5, 5, 0))
    return np.clip(low + hp * detail_gain, 0, 1)


def pad_reflect(rgba, pad, soften=6.0):
    """Extend a layer past the frame by mirroring, softened, so the camera can see a
    little beyond the painting's edge. pad = (left and right, top and bottom) in px."""
    px, py = pad
    if px <= 0 and py <= 0:
        return rgba
    p = np.pad(rgba, ((py, py), (px, px), (0, 0)), mode="symmetric")
    soft = ndi.gaussian_filter(p, (soften, soften, 0))
    m = np.ones(p.shape[:2], np.float32)
    m[py:p.shape[0] - py, px:p.shape[1] - px] = 0
    m = ndi.gaussian_filter(m, 12)
    m[py:p.shape[0] - py, px:p.shape[1] - px] = 0
    m = np.clip(m * 1.6, 0, 1)[..., None]
    return p * (1 - m) + soft * m


def scene_depth(a, cfg):
    """Depth, sky and the plants standing against the sky, for one painting."""
    if cfg.get("window"):
        d, sky = wm.room_depth(a, cfg["window"], cfg["hy"])
        return d, sky, np.zeros_like(sky)
    d, sky, _, plants_on_sky = wm.depth_map(a, cfg["hy"])
    if cfg.get("building"):
        d = wm.lift_building(d, sky, **cfg["building"])
    return d, sky, plants_on_sky


def build_scene(key, cfg):
    img = Image.open(os.path.join(ROOT, cfg["src"])).convert("RGB")
    assert img.size == (W, H), img.size
    a = np.asarray(img).astype(np.float32) / 255
    d, sky, plants_on_sky = scene_depth(a, cfg)
    sky_soft = ndi.gaussian_filter(sky.astype(np.float32), 1.2)
    # behind a plant that stands against the sky there is sky, not hills: the layers behind
    # the plant get a hole there so the sky layer shows through
    sky_hole = ndi.gaussian_filter(ndi.binary_dilation(plants_on_sky, iterations=5).astype(np.float32), 2.5)

    layers = {}
    # sky: opaque, the non-sky filled in smoothly from the sky around it
    sky_rgb = wm.sky_fill_rows(a, ndi.binary_erosion(sky, iterations=4))
    sky_rgb = a * sky_soft[..., None] + sky_rgb * (1 - sky_soft[..., None])
    sky_rgba = np.concatenate([sky_rgb, np.ones((H, W, 1), np.float32)], axis=2)
    layers["sky"] = (pad_reflect(sky_rgba, SKY_PAD), SKY_PAD)

    ts = [k[1] for k in KINDS] + [9]
    for i, (kind, t0, pad) in enumerate(KINDS):
        t1 = ts[i + 1]
        # alpha: everything at this depth or nearer; the sky cut stays as the sky mask says
        alpha = wm.smoothstep(t0 - BAND, t0 + BAND, d) * (1 - sky_soft)
        if kind == "far":
            alpha = 1 - sky_soft
        if kind != "fore":
            alpha = alpha * (1 - sky_hole)
        own = (d >= t0 - BAND) & (d < t1) & ~sky
        fill = fill_for(a, ndi.binary_erosion(own, iterations=1), DETAIL_GAIN[kind])
        w_near = wm.smoothstep(t1 - BAND, t1 + BAND, d)[..., None]
        rgb = a * (1 - w_near) + fill * w_near if t1 < 9 else a
        rgba = np.concatenate([rgb, alpha[..., None]], axis=2)
        layers[kind] = (pad_reflect(rgba, pad), pad)
        print(f"  {key}_{kind}: {100 * float((alpha > 0.5).mean()):.0f}% of the frame")

    os.makedirs(OUT, exist_ok=True)
    meta = []
    for kind in ["sky"] + [k[0] for k in KINDS]:
        arr, pad = layers[kind]
        im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
        name = f"{key}_{kind}{REV}.webp"
        path = os.path.join(OUT, name)
        if kind == "sky":
            im.convert("RGB").save(path, quality=82, method=6)
        else:
            im.save(path, quality=82, alpha_quality=92, method=6)
        w, h = im.size
        meta.append(dict(kind=kind, src=f"/img/world/{name}", pad=list(pad), px=[w, h],
                         x=-100 * pad[0] / W, y=-100 * pad[1] / H, w=100 * w / W, h=100 * h / H))
        print(f"  wrote {name} {w}x{h} {os.path.getsize(path) // 1024} KB")
    if cfg.get("glint"):
        glint_meta, glint_alpha = build_glint(key, a, d, sky, cfg["water"])
        meta.append(glint_meta)
        layers["glint"] = (glint_alpha, (0, 0))
    return dict(vp=dict(x=100 * cfg["vp"][0] / W, y=100 * cfg["vp"][1] / H), layers=meta), layers


def build_glint(key, a, d, sky, outline):
    """The ripple highlights on the river as a white layer that the page drifts and
    breathes (a still picture of moving water). The painting's own ripples, picked
    out along the water, cropped to the river."""
    pm = Image.new("L", (W, H), 0)
    for poly in outline:
        ImageDraw.Draw(pm).polygon(poly, fill=255)
    inside = np.asarray(pm) > 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenish = (g > b + 0.03) & (g > r + 0.02)
    water = inside & ~greenish
    water = ndi.binary_closing(ndi.binary_opening(water, iterations=2), iterations=6)
    soft = ndi.gaussian_filter(water.astype(np.float32), 5)
    lum = a.mean(2)
    hp = np.clip(lum - ndi.gaussian_filter(lum, (2, 14)), 0, None)
    hp = ndi.gaussian_filter(hp / max(np.percentile(hp[water], 99), 1e-6), (0.8, 1.6))
    alpha = np.clip(hp, 0, 1) ** 0.9 * soft * 0.8
    ys, xs = np.where(alpha > 0.01)
    x0, x1, y0, y1 = (int(v) for v in (max(xs.min() - 8, 0), min(xs.max() + 8, W), max(ys.min() - 8, 0), min(ys.max() + 8, H)))
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alpha[y0:y1, x0:x1] * 255 + 0.5).astype(np.uint8)
    name = f"{key}_glint{REV}.webp"
    path = os.path.join(OUT, name)
    Image.fromarray(rgba, "RGBA").save(path, quality=80, alpha_quality=90, method=6)
    print(f"  wrote {name} {x1 - x0}x{y1 - y0} {os.path.getsize(path) // 1024} KB")
    meta = dict(kind="glint", src=f"/img/world/{name}", pad=[0, 0], px=[x1 - x0, y1 - y0],
                x=100 * x0 / W, y=100 * y0 / H, w=100 * (x1 - x0) / W, h=100 * (y1 - y0) / H)
    return meta, alpha


# --- the phone's version: the same layers, cropped to a portrait window around the vanishing point
PORTRAIT_DIR = os.path.join(ROOT, "prototype-mobile", "assets", "world")
P_HALF = 389          # source px either side of the vanishing point that are kept (the phone shows +-249)
P_SHOW = 249          # source px either side that fill the phone's width at 1080 x 2340
P_K = 2340 / 1080     # phone-stage px per source px


def export_portrait(key, cfg, layers):
    """Writes prototype-mobile/assets/world/<key>_<kind>.webp and returns the manifest. The phone
    stage is 1080 x 2340, so the painting is scaled to its height and only its middle shows; the
    extra width kept either side is what the camera's start pose and the sway need."""
    os.makedirs(PORTRAIT_DIR, exist_ok=True)
    vx = cfg["vp"][0]
    x0, x1 = vx - P_HALF, vx + P_HALF
    metas = []
    for kind in ["sky", "far", "mid", "near", "fore", "glint"]:
        if kind not in layers:
            continue
        arr, pad = layers[kind]
        if kind == "glint":
            rgba = np.zeros((H, W, 4), np.float32)
            rgba[..., :3] = 1
            rgba[..., 3] = arr
            arr, pad = rgba, (0, 0)
        crop = arr[:, x0 + pad[0]: x1 + pad[0]]
        top = -pad[1]
        cxo = 0
        if kind == "glint":
            ys, xs = np.where(crop[..., 3] > 0.01)
            cy0, cy1, cx0, cx1 = int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1
            crop, top, cxo = crop[cy0:cy1, cx0:cx1], cy0, cx0
        im = Image.fromarray((np.clip(crop, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
        name = f"{key}_{kind}{REV}.webp"
        path = os.path.join(PORTRAIT_DIR, name)
        if kind == "sky":
            im.convert("RGB").save(path, quality=80, method=6)
        else:
            im.save(path, quality=80, alpha_quality=90, method=6)
        left = (x0 + cxo - (vx - P_SHOW)) * P_K
        metas.append(dict(
            kind=kind, src=f"assets/world/{name}",
            x=100 * left / 1080, y=100 * top * P_K / 2340,
            w=100 * im.width * P_K / 1080, h=100 * im.height * P_K / 2340,
        ))
    vp = dict(x=100 * P_SHOW * P_K / 1080, y=100 * cfg["vp"][1] / H)
    return dict(vp=vp, layers=metas)


def composite(layers, scales, vp, order):
    """Over-composite the padded layers, each scaled about the vanishing point."""
    out = np.zeros((H, W, 3), np.float32)
    first = True
    for kind in order:
        arr, pad = layers[kind]
        s = scales[kind]
        im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGBA")
        im = im.resize((int(im.width * s), int(im.height * s)), Image.Resampling.BILINEAR)
        x0 = vp[0] + (-pad[0] - vp[0]) * s
        y0 = vp[1] + (-pad[1] - vp[1]) * s
        canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        canvas.paste(im, (int(round(x0)), int(round(y0))))
        c = np.asarray(canvas).astype(np.float32) / 255
        al = c[..., 3:4]
        out = c[..., :3] if first else c[..., :3] * al + out * (1 - al)
        first = False
    return out


def main():
    preview = "--preview" in sys.argv
    manifest = {}
    built = {}
    for key, cfg in SCENES.items():
        print(key, cfg["name"])
        manifest[cfg["name"]], built[key] = build_scene(key, cfg)
    ts = "// Generated by scripts/design/build_world.py; do not edit by hand.\n"
    ts += "export const worldLayers = " + json.dumps(manifest, indent=2) + " as const;\n"
    with open(os.path.join(ROOT, "config", "world-layers.generated.ts"), "w", encoding="utf-8", newline="\n") as f:
        f.write(ts)
    if os.path.isdir(os.path.join(ROOT, "prototype-mobile")):
        phone = {SCENES[k]["name"]: export_portrait(k, SCENES[k], built[k]) for k in SCENES}
        out_js = os.path.join(ROOT, "prototype-mobile", "assets", "world.js")
        with open(out_js, "w", encoding="utf-8", newline="\n") as f:
            f.write("// Generated by scripts/design/build_world.py; do not edit by hand.\n")
            f.write("window.WORLD = " + json.dumps(phone, indent=1) + ";\n")
    if preview:
        scratch = os.environ.get("WORLD_PREVIEW_DIR", ".")
        order = ["sky", "far", "mid", "near", "fore"]
        steps = [
            dict(sky=1, far=1, mid=1, near=1, fore=1),
            dict(sky=1, far=1.03, mid=1.35, near=1.9, fore=2.8),
            dict(sky=1, far=1.06, mid=1.9, near=3.4, fore=6.0),
        ]
        for key, cfg in SCENES.items():
            frames = [composite(built[key], sc, cfg["vp"], order) for sc in steps]
            strip = np.concatenate(frames, axis=1)
            Image.fromarray((np.clip(strip, 0, 1) * 255).astype(np.uint8)).resize((1920, 360)).save(
                os.path.join(scratch, f"world_{key}_forward.png"))


if __name__ == "__main__":
    main()
