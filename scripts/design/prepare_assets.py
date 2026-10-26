"""
Slices the v3 mockups into animatable layers (docs/REDESIGN_PLAN.md, step 1).

    python scripts/design/prepare_assets.py [--out DIR]

Reads the flat mockups in docs/design/v3/ and writes the layered assets the site
uses: images under public/img/scenes/<scene>/, the fly-through at
public/video/to-wedding.mp4 and config/scene-layers.generated.ts (each layer's
position as a % of the 16:9 stage, plus its pixel size). With --out DIR it writes
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
_args = argparse.ArgumentParser(description=__doc__.splitlines()[1])
_args.add_argument("--out", help="write flat into DIR instead of the site's public/ tree")
_out_arg = _args.parse_args().out
SITE = _out_arg is None
OUT = os.path.abspath(_out_arg) if _out_arg else os.path.join(REPO, "public", "img", "scenes")
VIDEO_OUT = os.path.join(REPO, "public", "video") if SITE else OUT
os.makedirs(OUT, exist_ok=True)
os.makedirs(VIDEO_OUT, exist_ok=True)

# The fly-through clip is used as-is (it is already faststart, video-only H.264).
FLY_SOURCE = "transition-04-05-flythrough.mp4"

# Which scene folder a file lands in, by name prefix (site layout only).
SCENE_DIRS = (("s01_", "gate"), ("s02_", "terminal"), ("s03_", "intro"), ("j05_", "wedding"))


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
def load(name, width):
    im = Image.open(os.path.join(ROOT, name)).convert("RGB")
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
img = load("01-plate-clean.jpg", W_HI)          # Chao's plate: same frame, no text, no pill, no logo
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
    bubble_sprite(img, bg, cx, cy, r, f"s01_bubble{i}.webp", f"s01_bubble{i}", W, H)

# the wordmark exists only in the mockup; its alpha is how much brighter it is than the plate's sky
logo_box = s(1520, 125, 1777, 350)
holes_logo = rect(sh, *logo_box)
la = np.clip((lum(mock) - lum(img)) / np.maximum(255 - lum(img), 1) * 1.35, 0, 1) * holes_logo
la[la < 0.06] = 0
box = save_rgba(np.full_like(img, 255), la, "s01_logo.webp", crop=logo_box)
place("s01_logo", "s01_logo.webp", box, W, H)

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
box = save_rgba(mock, feather(mon_mask, 1.0), "s01_monitor.webp")
place("s01_monitor", "s01_monitor.webp", box, W, H)
box = save_rgba(clean, fg_alpha, "s01_fg.webp", crop=(0, 0, W, H))
place("s01_fg", "s01_fg.webp", box, W, H)

sky = inpaint(clean, ndi.binary_dilation(ground, iterations=8), iters=30)
pad = round(W * 0.06)  # mirrored margin so the clouds can drift sideways
sky = np.pad(sky, ((0, 0), (pad, pad), (0, 0)), mode="reflect")
save_rgb(sky, "s01_sky.jpg", 84)
manifest["s01_sky"] = dict(src=target("s01_sky.jpg")[1], px=[sky.shape[1], sky.shape[0]],
                           x=-100 * pad / W, y=0, w=100 + 200 * pad / W, h=100)

orig = Image.open(os.path.join(ROOT, "01-password.jpg")).convert("RGB")
scr = (1514, 616, 1684, 752)
orig.crop(scr).save(target("s01_screen.jpg")[0], quality=90)
place("s01_screen", "s01_screen.jpg", scr, 3288, 1850)
manifest["s01_screen"]["px"] = [scr[2] - scr[0], scr[3] - scr[1]]
# where the live password pill and the heading sit (% of the stage), measured on the mockup
manifest["s01_input"] = dict(x=100 * 646 / 1600, y=100 * 533 / 900, w=100 * 294 / 1600, h=100 * 75 / 900)
manifest["s01_heading"] = dict(cx=100 * 986 / 1998, cy=100 * 590 / 1125, size=100 * 45 / 1998)
manifest["s01_subtitle"] = dict(cx=100 * 986 / 1998, cy=100 * 639 / 1125, size=100 * 14.5 / 1998)

# ---------------------------------------------------------------- screen 02
print("screen 02 ...")
_s02 = load("02-splash-login-1.jpg", W_HI)
save_rgb(_s02, "s02_bg.jpg", 86)
full("s02_bg", "s02_bg.jpg", _s02)
manifest["s02_screen"] = dict(x=100 * 152 / 3288, y=100 * 73 / 1850, w=100 * 2977 / 3288, h=100 * 1723 / 1850)

# ---------------------------------------------------------------- screen 03
print("screen 03 ...")
img = load("03-intro-vid.jpg", W_HI)
H, W = img.shape[:2]
sh = (H, W)

def measure_screen(img):
    """Inner edge of the monitor bezel, found by scanning in from each side for grass."""
    H, W = img.shape[:2]
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    L_ = lum(img)
    grassy = ((g >= r - 6) & ((g - b) > 0.25 * g) & (L_ < 150)) | (L_ < 40)
    run = ndi.minimum_filter1d(grassy.astype(np.uint8), 5, axis=1, origin=-2)
    runv = ndi.minimum_filter1d(grassy.astype(np.uint8), 5, axis=0, origin=-2)
    band = int(300 * K)

    def first_hit(a, axis):
        a = a[:, :band] if axis == 1 else a[:band]
        hit = a.argmax(axis=axis).astype(np.float32)
        hit[a.max(axis=axis) == 0] = band
        return ndi.median_filter(hit, 61, mode="nearest")

    def fit(edge, inward_sign):
        # gentle curve through the scan; misses only ever err inward, so reject those
        n = len(edge)
        t = np.arange(n, dtype=np.float64)
        sel = (t > n * 0.12) & (t < n * 0.88) & (edge < band)
        for _ in range(8):
            c = np.polyfit(t[sel], edge[sel], 2)
            res = (edge - np.polyval(c, t)) * inward_sign
            sel &= res < 2.5
        return np.polyval(c, t) - 1.5 * inward_sign

    L = fit(first_hit(run, 1), 1)
    R = W - 1 - fit(first_hit(run[:, ::-1], 1), 1)
    T = fit(first_hit(runv, 0), 1)
    B = H - 1 - fit(first_hit(runv[::-1], 0), 1)
    yy, xx = np.mgrid[:H, :W]
    m = (xx >= L[:, None]) & (xx <= R[:, None]) & (yy >= T[None, :]) & (yy <= B[None, :])
    rad = 78 * K  # round the corners (morphological opening by a disk)
    core = ndi.distance_transform_edt(m) > rad
    return ndi.distance_transform_edt(~core) <= rad


interior_tight = measure_screen(img)
interior =ndi.binary_dilation(interior_tight, iterations=int(10 * K) + 2)

bub03 = [(633, 482, 49), (665, 845, 26), (327, 1069, 64), (442, 1184, 22), (536, 1442, 51),
         (1078, 1433, 31), (913, 1613, 36), (318, 1664, 131), (2615, 238, 60), (2878, 636, 98),
         (2278, 716, 26), (2942, 1273, 118)]
bub03 = [s(*b) for b in bub03]
nav_box = s(1036, 103, 1970, 201)
rsvp_box = s(2334, 98, 2559, 202)
mute = s(187, 1705, 60)
logo_box = s(236, 92, 372, 208)
verse_box = s(2290, 1550, 3125, 1765)

ub = np.zeros(sh, bool)
for cx, cy, r in bub03:
    ub |= disk(sh, cx, cy, r * 1.1)
ui = rect(sh, *nav_box) | rect(sh, *rsvp_box)

# video blob (the flat blue area)
r_, g_, b_ = img[..., 0], img[..., 1], img[..., 2]
blue = (b_ > r_ + 25) & (b_ > g_ + 5) & (b_ > 140) & interior
lab, n = ndi.label(blue)
blob = lab == lab[int(925 * K), int(1644 * K)]
blob = ndi.binary_fill_holes(blob)
bf = inpaint(blob.astype(np.float32), ub | ui, iters=60) > 0.5
blob = ndi.binary_fill_holes(bf | blob)
blob = ndi.binary_opening(blob, iterations=2)
blob = ndi.binary_dilation(blob, iterations=3)  # eat the pale halo on grass tips
blob_alpha = feather(blob, 1.4)
ys, xs = np.where(blob)
bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
manifest["s03_blob"] = dict(x=100 * bb[0] / W, y=100 * bb[1] / H, w=100 * (bb[2] - bb[0]) / W, h=100 * (bb[3] - bb[1]) / H)
save_rgba(np.full_like(img, 255), blob_alpha, "s03_blobmask.webp", crop=bb, q=80)

# move grass texture over the baked verse so it can be live text
work = img.copy()
vx0, vy0, vx1, vy1 = [int(v) for v in verse_box]
dx = int(860 * K)
patch = work[vy0:vy1, vx0 - dx : vx1 - dx]
fm = np.zeros((vy1 - vy0, vx1 - vx0), np.float32)
fm[12:-12, 12:-12] = 1
fm = feather(fm, 7)[..., None]
work[vy0:vy1, vx0:vx1] = work[vy0:vy1, vx0:vx1] * (1 - fm) + patch * fm

mute_m = disk(sh, *mute)
holes = ub | ui | mute_m | rect(sh, *logo_box)
bg = inpaint(work, holes)

mute_soft = feather(disk(sh, mute[0], mute[1], mute[2] * 1.05), 2)
for i, (cx, cy, r) in enumerate(bub03):
    bubble_sprite(work, bg, cx, cy, r, f"s03_bubble{i}.webp", f"s03_bubble{i}", W, H, exclude=mute_soft)

la = np.clip((lum(work) - lum(bg)) / np.maximum(255 - lum(bg), 1) * 1.5, 0, 1) * rect(sh, *logo_box)
la[la < 0.08] = 0
box = save_rgba(np.full_like(img, 255), la, "s03_logo.webp", crop=logo_box)
place("s03_logo", "s03_logo.webp", box, W, H)

clean = bg
grass_region = interior_tight & ~ndi.binary_dilation(blob, iterations=int(14 * K))
grass_region &= ~ndi.binary_dilation(~interior_tight, iterations=int(14 * K))
mx, mn = clean.max(2), clean.min(2)
petals = (lum(clean) > 185) & ((mx - mn) < 60) & grass_region
fl = ndi.binary_dilation(petals, iterations=2) & grass_region
lab, n = ndi.label(fl)
sizes = ndi.sum(fl, lab, range(1, n + 1))
fl = np.isin(lab, np.where(sizes >= 6)[0] + 1)
grass_alpha = feather(interior, 1.0) * (1 - blob_alpha)
flower_alpha = feather(fl, 0.7) * grass_alpha
box = save_rgba(clean, flower_alpha, "s03_flowers.webp")
place("s03_flowers", "s03_flowers.webp", box, W, H)
grass = inpaint(clean, ndi.binary_dilation(fl, iterations=2), iters=30)

# split the grass ring into 4 pieces (top / right / bottom / left) by angle
yy, xx = np.mgrid[:H, :W].astype(np.float32)
ang = np.degrees(np.arctan2((yy - H * 0.5) / H, (xx - W * 0.5) / W))
sectors = {"top": (ang >= -135) & (ang < -45), "right": (ang >= -45) & (ang < 45),
           "bottom": (ang >= 45) & (ang < 135), "left": (ang >= 135) | (ang < -135)}
for name, m in sectors.items():
    # generous feathered overlap: identical pixels at rest, no cracks while pieces slide in
    reach = int(28 * K)
    soft = np.clip(1 - ndi.distance_transform_edt(~m) / reach, 0, 1)
    soft = np.maximum(soft, ndi.binary_dilation(m, iterations=2))
    a = grass_alpha * soft
    box = save_rgba(grass, a, f"s03_grass_{name}.webp")
    place(f"s03_grass_{name}", f"s03_grass_{name}.webp", box, W, H)

bezel_alpha = 1 - feather(interior_tight, 1.2)
box = save_rgba(img, bezel_alpha, "s03_bezel.webp", crop=(0, 0, W, H))
place("s03_bezel", "s03_bezel.webp", box, W, H)
manifest["s03_interior"] = dict(x=100 * 66 / 3288, y=100 * 42 / 1850, w=100 * (3225 - 66) / 3288, h=100 * (1803 - 42) / 1850)
manifest["s03_mute"] = dict(cx=100 * 187 / 3288, cy=100 * 1705 / 1850, d=100 * 112 / 3288)

# ---------------------------------------------------------------- screens 04 / 05
print("screens 04 / 05 ...")
W, H = 1920, 1080
sh = (H, W)

# What the mockups bake in but the site renders for real: the wordmark, the nav pill, RSVP.
CHROME = [(45, 30, 160, 130), (580, 36, 1326, 120), (1722, 36, 1882, 120)]
chrome = np.zeros(sh, bool)
for b in CHROME:
    chrome |= rect(sh, *b)


def matte(im, bg, region):
    """Alpha for a pixel-art sprite sitting on `bg`: solid inside, soft at the edge."""
    d = np.abs(im - bg).max(2)
    solid = ndi.binary_fill_holes((d > 45) & region)
    a = np.maximum(np.clip((d - 14) / 36.0, 0, 1) * region, feather(solid, 0.6))
    F = np.where(a[..., None] > 0.9, im, bg + (im - bg) / np.maximum(a, 0.08)[..., None])
    return F, a


# (mockup, name, folder icon + label box, cursor box, area to paint out)
for src, out, fold_box, cur_box, hole_box in [
    ("04-journey-00.jpg", "j00", (905, 480, 1010, 598), (1004, 536, 1064, 616), (895, 474, 1075, 625)),
    ("05-new-chapter.jpg", "j05", (900, 480, 1012, 598), (1014, 519, 1072, 599), (895, 474, 1080, 625)),
]:
    im = load(src, W)
    bg = inpaint(im, chrome | rect(sh, *hole_box))
    save_rgb(bg, out + "_bg.jpg", 88)
    full(out + "_bg", out + "_bg.jpg", bg)
    cur = rect(sh, *cur_box)
    F, a = matte(im, bg, rect(sh, *fold_box) & ~cur)
    box = save_rgba(F, a, out + "_folder.webp")
    place(out + "_folder", out + "_folder.webp", box, W, H)
    if out == "j00":
        F, a = matte(im, bg, cur)
        box = save_rgba(F, a, "cursor.webp", crop=cur_box)
        place("cursor", "cursor.webp", box, W, H)

manifest["j05_cursor"] = dict(x=100 * 1016 / W, y=100 * 524 / H)

# --- the glass window: one frame per active tab, with the tab labels, the body and the photos
# taken out so the site can put real text, photos and video in it.
win_box = (194, 244, 1716, 962)
win_mask = rounded_rect(sh, win_box[0], win_box[1], win_box[2] - 1, win_box[3] - 1, 26)
win_alpha = feather(win_mask, 1.0)
TABS = [(325, 515), (520, 725), (730, 935), (940, 1145), (1150, 1345)]
body = feather(rounded_rect(sh, 222, 352, 1686, 934, 14), 3)[..., None]
wins = [load(f"04-journey-{n}.jpg", W) for n in range(6)]
for i, w_im in enumerate(wins):
    f = w_im * (1 - body) + wins[0] * body if i else w_im.copy()
    holes = np.zeros(sh, bool)
    green = (f[..., 1] > f[..., 0] + 14) & (f[..., 1] > f[..., 2] + 14)
    L = lum(f)
    for x0, x1 in TABS:
        reg = rect(sh, x0 + 18, 276, x1 - 12, 324)
        local = ndi.median_filter(L[270:330, x0:x1], size=(1, 41), mode="nearest")
        dark = np.zeros(sh, bool)
        dark[270:330, x0:x1] = L[270:330, x0:x1] < local - 14
        holes |= (dark | green) & reg
    holes = ndi.binary_dilation(holes, iterations=3)
    f = inpaint(f, holes, iters=30)
    box = save_rgba(f, win_alpha, f"frame{i}.webp", crop=win_box, q=90)
    place(f"frame{i}", f"frame{i}.webp", box, W, H)


# --- stand-in chapter photos, cropped from the mockups until the originals arrive.
# Boxes were read off the mockups (+-5 px), then snapped to the strongest edge nearby.
def sheet(c, tx=0, ty=0):
    return tuple(round(v) for v in (210 + (c[0] - tx) / 0.6, 340 + (c[1] - ty) / 0.6,
                                    210 + (c[2] - tx) / 0.6, 340 + (c[3] - ty) / 0.6))


APPROX = {
    1: [(885, 412, 1181, 628), (1226, 412, 1598, 628), (1398, 656, 1633, 871)],
    2: [sheet(c) for c in [(317, 49, 429, 201), (461, 49, 538, 201), (570, 49, 827, 192), (655, 203, 842, 328)]],
    3: [sheet(c, 894, 0) for c in [(1430, 29, 1575, 221), (1610, 31, 1724, 173), (1486, 237, 1557, 331), (1588, 198, 1761, 339)]],
    4: [sheet(c, 0, 363) for c in [(281, 400, 461, 496), (471, 402, 561, 496), (570, 402, 755, 497), (765, 415, 877, 496),
                                   (281, 516, 371, 611), (384, 519, 608, 611), (621, 517, 732, 609), (743, 517, 868, 607),
                                   (739, 624, 872, 692)]],
    5: [sheet(c, 894, 363) for c in [(1442, 427, 1612, 659), (1628, 427, 1708, 511), (1628, 522, 1748, 659)]],
}
VIDEO_BOX = (260, 388, 840, 871)  # the dark placeholder, the same on every tab (measured on tab 1)


def snap(L, box, reach=10):
    """Move each side of `box` to the strongest brightness edge within `reach` px."""
    x0, y0, x1, y1 = box
    mx, my = (x1 - x0) // 5, (y1 - y0) // 5
    gx = np.abs(np.diff(L, axis=1))
    gy = np.abs(np.diff(L, axis=0))

    def best(prof, c):
        lo = max(0, c - reach)
        return lo + int(np.argmax(prof[lo : c + reach + 1]))

    px_ = gx[y0 + my : y1 - my, :].mean(0)
    py_ = gy[:, x0 + mx : x1 - mx].mean(1)
    return best(px_, x0), best(py_, y0), best(px_, x1) + 1, best(py_, y1) + 1


manifest["chapters"] = {}
INSET = 3
ww, wh = win_box[2] - win_box[0], win_box[3] - win_box[1]
for ch, boxes in APPROX.items():
    L = lum(wins[ch])
    items = []
    for k, bx in enumerate(boxes, 1):
        x0, y0, x1, y1 = snap(L, bx)
        x0, y0, x1, y1 = x0 + INSET, y0 + INSET, x1 - INSET, y1 - INSET
        name = f"ch{ch}_{k}.jpg"
        Image.fromarray(np.clip(wins[ch][y0:y1, x0:x1], 0, 255).astype(np.uint8)).save(target(name)[0], quality=90)
        items.append(dict(src=target(name)[1], px=[x1 - x0, y1 - y0],
                          x=100 * (x0 - win_box[0]) / ww, y=100 * (y0 - win_box[1]) / wh,
                          w=100 * (x1 - x0) / ww, h=100 * (y1 - y0) / wh))
    manifest["chapters"][str(ch)] = items
manifest["window_video_slot"] = dict(
    x=100 * (VIDEO_BOX[0] - win_box[0]) / ww, y=100 * (VIDEO_BOX[1] - win_box[1]) / wh,
    w=100 * (VIDEO_BOX[2] - VIDEO_BOX[0]) / ww, h=100 * (VIDEO_BOX[3] - VIDEO_BOX[1]) / wh)

# --- the 04 -> 05 fly-through
shutil.copyfile(os.path.join(ROOT, FLY_SOURCE), os.path.join(VIDEO_OUT, "to-wedding.mp4"))
manifest["video_fly"] = dict(src="/video/to-wedding.mp4" if SITE else "to-wedding.mp4")

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
