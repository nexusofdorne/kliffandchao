"""
Slices the v3 mockups and the 3.0 backgrounds into animatable layers (docs/REDESIGN_PLAN.md, step 1).

    python scripts/design/prepare_assets.py [--out DIR]

Reads the flat mockups in docs/design/v3/ and writes the layered assets the site
uses: images under public/img/scenes/<scene>/ and config/scene-layers.generated.ts
(each layer's position as a % of the 16:9 stage, plus its pixel size). Screen 03's
grass ring and the 04 -> 05 fly-through clip are gone: the intro film plays on screen
02's monitor and the camera moves are drawn from depth layers (build_world.py). With --out DIR it writes
everything flat into DIR instead, with manifest.json, for experiments.
(prototype-v3/assets/ holds the output of the first version of this script and is
frozen.) Offline design tooling: not part of the Next.js build, and needs Python 3
with numpy, scipy and Pillow. Takes about three minutes.

The layers are cut automatically: colour segmentation for sky, ground, the
video blob and the bezel edge, harmonic inpainting under bubbles and UI, and
alpha-matting for the translucent bubbles. Screen 01 is cut from Chao's text-free
plate (01-plate-clean.jpg, registered 1:1 with the mockup); on 04/05 the baked-in
logo, nav pill, RSVP and folder are painted out, because the site renders those as
real elements. Expect small seams up close.

Since the 3.0 assets (October 2026) the backgrounds come from docs/design/v4/: screen 01's plate
and screen 02's bezel are the same frames as v3 at a higher resolution, and screens 04/05 are the
new journey path and wedding hall, which are clean (nothing to paint out); their folder and cursor
come from the designer's transparent overlays. Changed pictures get a new name (-v4), because
media is cached for a week as immutable (vercel.json).

Coordinates below were measured on the mockups:
  01-03 -> 3288 x 1850 space, 04/05 -> 1920 x 1080 space.
"""
import argparse
import json
import os
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ROOT = os.path.join(REPO, "docs", "design", "v3")
V4 = os.path.join(REPO, "docs", "design", "v4")
_args = argparse.ArgumentParser(description=__doc__.splitlines()[1])
_args.add_argument("--out", help="write flat into DIR instead of the site's public/ tree")
_out_arg = _args.parse_args().out
SITE = _out_arg is None
OUT = os.path.abspath(_out_arg) if _out_arg else os.path.join(REPO, "public", "img", "scenes")
VIDEO_OUT = os.path.join(REPO, "public", "video") if SITE else OUT
os.makedirs(OUT, exist_ok=True)
os.makedirs(VIDEO_OUT, exist_ok=True)

# Which scene folder a file lands in, by name prefix (site layout only).
SCENE_DIRS = (("s01_", "gate"), ("s02_", "terminal"), ("j05_", "wedding"))


def target(name):
    """(absolute path, public URL) for an output file; creates the folder."""
    if not SITE:
        return os.path.join(OUT, name), name
    sub = next((d for p, d in SCENE_DIRS if name.startswith(p)), "journey")
    if name.startswith("ch"):
        sub = "journey/standin"
    os.makedirs(os.path.join(OUT, *sub.split("/")), exist_ok=True)
    return os.path.join(OUT, *sub.split("/"), name), f"/img/scenes/{sub}/{name}"

W_HI = 2560          # working width for screens 01-03
K = W_HI / 3288.0    # 3288-space -> working space
manifest = {}


# ---------------------------------------------------------------- helpers
def load(name, width, root=ROOT):
    im = Image.open(os.path.join(root, name)).convert("RGB")
    h = round(im.height * width / im.width)
    return np.asarray(im.resize((width, h), Image.Resampling.LANCZOS)).astype(np.float32)


def disk(shape, cx, cy, r):
    yy, xx = np.ogrid[: shape[0], : shape[1]]
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def rect(shape, x0, y0, x1, y1):
    m = np.zeros(shape, bool)
    m[max(0, int(y0)) : int(y1), max(0, int(x0)) : int(x1)] = True
    return m


def rounded_rect(shape, x0, y0, x1, y1, r):
    yy, xx = np.mgrid[: shape[0], : shape[1]].astype(np.float32)
    cx = np.clip(xx, x0 + r, x1 - r)
    cy = np.clip(yy, y0 + r, y1 - r)
    return (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r


def polygon(shape, pts):
    from PIL import ImageDraw
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
    return np.asarray(im) > 127


def _down(img, w):
    H, W = w.shape
    if H % 2 or W % 2:
        img = np.pad(img, ((0, H % 2), (0, W % 2), (0, 0)), mode="edge")
        w = np.pad(w, ((0, H % 2), (0, W % 2)), mode="constant")
    iw = img * w[..., None]
    s = iw[0::2, 0::2] + iw[1::2, 0::2] + iw[0::2, 1::2] + iw[1::2, 1::2]
    ws = w[0::2, 0::2] + w[1::2, 0::2] + w[0::2, 1::2] + w[1::2, 1::2]
    return s / np.maximum(ws, 1e-6)[..., None], (ws > 0).astype(np.float32)


def _jacobi(cur, known, iters):
    unk = known < 0.5
    for _ in range(iters):
        p = np.pad(cur, ((1, 1), (1, 1), (0, 0)), mode="edge")
        avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) * 0.25
        cur[unk] = avg[unk]
    return cur


def inpaint(img, mask, iters=40):
    """Multiscale harmonic fill of `mask` pixels (smooth, good for sky / soft areas)."""
    squeeze = img.ndim == 2
    if squeeze:
        img = img[..., None]
    levels = [(img.astype(np.float32), (~mask).astype(np.float32))]
    while min(levels[-1][1].shape) > 24:
        levels.append(_down(*levels[-1]))
    cur, k = levels[-1]
    cur = cur.copy()
    if (k > 0).any():
        cur[k < 0.5] = cur[k > 0.5].mean(0)
    cur = _jacobi(cur, k, 200)
    for im, k in reversed(levels[:-1]):
        up = np.repeat(np.repeat(cur, 2, 0), 2, 1)[: im.shape[0], : im.shape[1]]
        cur = np.where(k[..., None] > 0.5, im, up)
        cur = _jacobi(cur, k, iters)
    return cur[..., 0] if squeeze else cur


def feather(mask, sigma):
    return np.clip(ndi.gaussian_filter(mask.astype(np.float32), sigma), 0, 1)


def save_rgb(arr, name, q=86):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(target(name)[0], quality=q)


def full(key, name, arr, **extra):
    """Register a full-stage image (no placement box)."""
    manifest[key] = dict(src=target(name)[1], px=[arr.shape[1], arr.shape[0]], **extra)


def save_rgba(rgb, alpha, name, crop=None, q=88):
    a = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    if crop is None:
        ys, xs = np.where(a > 2)
        crop = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    x0, y0, x1, y1 = [int(v) for v in crop]
    im = Image.fromarray(np.dstack([rgb, a])[y0:y1, x0:x1], "RGBA")
    im.save(target(name)[0], "WEBP", quality=q, method=6)
    return x0, y0, x1, y1


def place(key, src, box, W, H, **extra):
    x0, y0, x1, y1 = box
    manifest[key] = dict(src=target(src)[1], x=100 * x0 / W, y=100 * y0 / H,
                         w=100 * (x1 - x0) / W, h=100 * (y1 - y0) / H,
                         px=[int(x1 - x0), int(y1 - y0)], **extra)


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def bubble_sprite(img, bg, cx, cy, r, name, key, W, H, exclude=None):
    """Matte a translucent bubble against its inpainted background."""
    pad = r * 1.18
    box = (max(0, cx - pad), max(0, cy - pad), min(W, cx + pad), min(H, cy + pad))
    circ = np.zeros(img.shape[:2], np.float32)
    yy, xx = np.ogrid[: img.shape[0], : img.shape[1]]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    circ = np.clip((r * 1.06 - dist) / (r * 0.08 + 1), 0, 1)
    d = np.abs(img - bg).max(2)
    a = np.clip(d / 28.0, 0, 1) ** 0.75
    a = np.maximum(a, 0.12) * circ
    if exclude is not None:
        a = a * (1 - exclude)
    F = bg + (img - bg) / np.maximum(a, 0.08)[..., None]
    box = save_rgba(F, a, name, crop=box)
    place(key, name, box, W, H)


# ---------------------------------------------------------------- screen 01
print("screen 01 ...")
mock = load("01-password.jpg", W_HI)            # has the heading, pill, logo and the couple on the screen
img = load("01-password-plate.jpg", W_HI, V4)   # the 3.0 plate: same frame, no text, no pill, no logo
assert img.shape == mock.shape, "plate and mockup must share one frame"
H, W = img.shape[:2]
sh = (H, W)
s = lambda *v: [x * K for x in v]

bub01 = [s(705, 720, 142), s(896, 902, 52), s(1089, 986, 16), s(308, 1225, 40)]
holes = np.zeros(sh, bool)
for cx, cy, r in bub01:
    holes |= disk(sh, cx, cy, r * 1.12)
bg = inpaint(img, holes)

for i, (cx, cy, r) in enumerate(bub01):
    bubble_sprite(img, bg, cx, cy, r, f"s01_bubble{i}-v4.webp", f"s01_bubble{i}", W, H)

# (the wordmark is drawn by the page now: components/site/chrome/Wordmark.tsx, from the 3.0 logo)

clean = bg  # bubbles removed; the heading, subtitle and pill were never in the plate

# ground (everything that must stay still while the sky drifts)
cap_pts = [(0, 1080), (420, 1110), (930, 1170), (1250, 1200), (2050, 1060), (2370, 1100),
           (2700, 1050), (3000, 1040), (3288, 1030)]
cx_ = np.array([p[0] for p in cap_pts]) * K
cy_ = np.array([p[1] for p in cap_pts]) * K
cap = np.interp(np.arange(W), cx_, cy_)
Y = np.arange(H)[:, None]
r_, g_, b_ = clean[..., 0], clean[..., 1], clean[..., 2]
ground = ((g_ > b_ + 18) & (lum(clean) < 215)) | (Y > cap[None, :])
mon = [(1492, 582), (1712, 560), (1808, 636), (1814, 874), (1466, 884), (1471, 592)]
ground |= polygon(sh, [(x * K, y * K) for x, y in mon])
ground = ndi.binary_closing(np.pad(ground, 8, mode="edge"), structure=np.ones((7, 7)))[8:-8, 8:-8]
ground = ndi.binary_fill_holes(ground)
lab, n = ndi.label(ground)
keep = np.unique(lab[-1][lab[-1] > 0])
ground = np.isin(lab, keep)
fg_alpha = feather(ground, 1.2)

# the monitor on its own, so it can stay in focus while the meadow blurs during the zoom.
# It is cut from the mockup so it matches the couple-on-screen crop laid over it.
mon_mask = ndi.binary_dilation(polygon(sh, [(x * K, y * K) for x, y in mon]), iterations=2)
box = save_rgba(mock, feather(mon_mask, 1.0), "s01_monitor-v4.webp")
place("s01_monitor", "s01_monitor-v4.webp", box, W, H)
box = save_rgba(clean, fg_alpha, "s01_fg-v4.webp", crop=(0, 0, W, H))
place("s01_fg", "s01_fg-v4.webp", box, W, H)

sky = inpaint(clean, ndi.binary_dilation(ground, iterations=8), iters=30)
pad = round(W * 0.06)  # mirrored margin so the clouds can drift sideways
sky = np.pad(sky, ((0, 0), (pad, pad), (0, 0)), mode="reflect")
save_rgb(sky, "s01_sky-v4.jpg", 84)
manifest["s01_sky"] = dict(src=target("s01_sky-v4.jpg")[1], px=[sky.shape[1], sky.shape[0]],
                           x=-100 * pad / W, y=0, w=100 + 200 * pad / W, h=100)

orig = Image.open(os.path.join(ROOT, "01-password.jpg")).convert("RGB")
scr = (1514, 616, 1684, 752)
orig.crop(scr).save(target("s01_screen.jpg")[0], quality=90)
place("s01_screen", "s01_screen.jpg", scr, 3288, 1850)
manifest["s01_screen"]["px"] = [scr[2] - scr[0], scr[3] - scr[1]]
# where the live password pill and the heading sit (% of the stage), measured on the 3.0
# reference (3.0/reference screenshots/01 - password.png, 1920 x 1080)
manifest["s01_input"] = dict(x=100 * 732 / 1920, y=100 * 683 / 1080, w=100 * 440 / 1920, h=100 * 45 / 1080)
manifest["s01_heading"] = dict(cx=100 * 958 / 1920, cy=100 * 589 / 1080, size=100 * 55 / 1920)
manifest["s01_subtitle"] = dict(cx=100 * 960 / 1920, cy=100 * 646 / 1080, size=100 * 15.5 / 1920)

# ---------------------------------------------------------------- screen 02
print("screen 02 ...")
_s02 = load("02-splash-login-1.jpg", W_HI, V4)
save_rgb(_s02, "s02_bg-v4.jpg", 86)
full("s02_bg", "s02_bg-v4.jpg", _s02)
manifest["s02_screen"] = dict(x=100 * 152 / 3288, y=100 * 73 / 1850, w=100 * 2977 / 3288, h=100 * 1723 / 1850)

# ---------------------------------------------------------------- screens 04 / 05
print("screens 04 / 05 ...")
W, H = 1920, 1080
sh = (H, W)

# The 3.0 journey path and wedding hall are clean paintings; the folder (icon and label) and the
# cursor come from the designer's transparent overlays, drawn on the same 1920 x 1080 frame.
FOLDER_ICON = {"j00": (1114, 803, 1208, 873), "j05": (920, 486, 1014, 556)}
CURSOR = {"j00": (1224, 884, 1260, 934), "j05": (1035, 539, 1070, 589)}


def sprite(overlay, box, name, key):
    x0, y0, x1, y1 = box
    crop = overlay.crop((x0 - 2, y0 - 2, x1 + 2, y1 + 2))
    crop.save(target(name)[0], quality=92, alpha_quality=100, method=6)
    place(key, name, (x0 - 2, y0 - 2, x1 + 2, y1 + 2), W, H)


for src, overlay_src, out in [
    ("03-journey.jpg", "03-journey-folder-overlay.png", "j00"),
    ("04-wedding.jpg", "04-wedding-folder-overlay.png", "j05"),
]:
    bg = load(src, W, V4)
    save_rgb(bg, out + "_bg-v4.jpg", 88)
    full(out + "_bg", out + "_bg-v4.jpg", bg)
    overlay = Image.open(os.path.join(V4, overlay_src)).convert("RGBA")
    assert overlay.size == (W, H), overlay.size
    sprite(overlay, FOLDER_ICON[out], out + "_folder-v4.webp", out + "_folder")
    if out == "j00":
        sprite(overlay, CURSOR[out], "cursor-v4.webp", "cursor")

# where the wedding's cursor comes to rest (the journey's rests where its sprite was cut)
manifest["j05_cursor"] = dict(x=100 * (CURSOR["j05"][0] - 2) / W, y=100 * (CURSOR["j05"][1] - 2) / H)

# --- manifest
if SITE:
    out_ts = os.path.join(REPO, "config", "scene-layers.generated.ts")
    with open(out_ts, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Generated by scripts/design/prepare_assets.py; do not edit by hand.\n"
                "// Positions are % of the 16:9 stage; px is the image's pixel size.\n"
                "import type { SceneAssets } from '@/lib/scene/layers';\n\n"
                "export const sceneAssets = ")
        json.dump(manifest, f, indent=2)
        f.write(" as const satisfies SceneAssets;\n")
else:
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
print("done ->", OUT)
