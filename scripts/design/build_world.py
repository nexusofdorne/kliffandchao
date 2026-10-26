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

SCENES = {
    "j": dict(name="journey", src="public/img/scenes/journey/j00_bg.jpg", hy=745, vp=(965, 745)),
    "w": dict(
        name="wedding",
        src="public/img/scenes/wedding/j05_bg.jpg",
        hy=650,
        vp=(955, 665),
        # the river's outline, read off the painting (the colour test below trims it to the water)
        water=[(575, 715), (780, 700), (1070, 700), (1180, 740), (1200, 800), (1390, 830), (1480, 900),
               (1460, 1000), (1420, 1080), (480, 1080), (520, 1010), (640, 950), (740, 935), (780, 900),
               (650, 860), (580, 790)],
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


def build_scene(key, cfg):
    img = Image.open(os.path.join(ROOT, cfg["src"])).convert("RGB")
    assert img.size == (W, H), img.size
    a = np.asarray(img).astype(np.float32) / 255
    d, sky, _, plants_on_sky = wm.depth_map(a, cfg["hy"])
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
        name = f"{key}_{kind}.webp"
        path = os.path.join(OUT, name)
        if kind == "sky":
            im.convert("RGB").save(path, quality=82, method=6)
        else:
            im.save(path, quality=82, alpha_quality=92, method=6)
        w, h = im.size
        meta.append(dict(kind=kind, src=f"/img/world/{name}", pad=list(pad), px=[w, h],
                         x=-100 * pad[0] / W, y=-100 * pad[1] / H, w=100 * w / W, h=100 * h / H))
        print(f"  wrote {name} {w}x{h} {os.path.getsize(path) // 1024} KB")
    if cfg.get("water"):
        meta.append(build_glint(key, a, d, sky, cfg["water"]))
    return dict(vp=dict(x=100 * cfg["vp"][0] / W, y=100 * cfg["vp"][1] / H), layers=meta), layers


def build_glint(key, a, d, sky, outline):
    """The ripple highlights on the river as a white layer that the page drifts and
    breathes (a still picture of moving water). The painting's own ripples, picked
    out along the water, cropped to the river."""
    pm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(pm).polygon(outline, fill=255)
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
    name = f"{key}_glint.webp"
    path = os.path.join(OUT, name)
    Image.fromarray(rgba, "RGBA").save(path, quality=80, alpha_quality=90, method=6)
    print(f"  wrote {name} {x1 - x0}x{y1 - y0} {os.path.getsize(path) // 1024} KB")
    return dict(kind="glint", src=f"/img/world/{name}", pad=[0, 0], px=[x1 - x0, y1 - y0],
                x=100 * x0 / W, y=100 * y0 / H, w=100 * (x1 - x0) / W, h=100 * (y1 - y0) / H)


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
