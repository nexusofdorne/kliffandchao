"""
Slices the v3 mockups into animatable layers (docs/REDESIGN_PLAN.md, step 1).

    python scripts/design/prepare_assets.py [--out DIR]

Reads the flat mockups in docs/design/v3/ and writes the layered assets plus
manifest.js (each layer's position as a % of the 16:9 stage). The default
output is prototype-v3/assets/. Offline design tooling: not part of the Next.js
build, and needs Python 3 with numpy, scipy and Pillow. Takes about three
minutes.

The layers are cut automatically: colour segmentation for sky, ground, the
video blob and the bezel edge, harmonic inpainting under bubbles and UI, and
alpha-matting for the translucent bubbles. Expect small seams up close.

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
_args.add_argument("--out", default=os.path.join(REPO, "prototype-v3", "assets"))
OUT = os.path.abspath(_args.parse_args().out)
os.makedirs(OUT, exist_ok=True)

# The fly-through clip is used as-is; it only needs to sit next to the layers.
FLY_SOURCE = "transition-04-05-flythrough.mp4"

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
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, name), quality=q)


def save_rgba(rgb, alpha, name, crop=None, q=88):
    a = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    if crop is None:
        ys, xs = np.where(a > 2)
        crop = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    x0, y0, x1, y1 = [int(v) for v in crop]
    im = Image.fromarray(np.dstack([rgb, a])[y0:y1, x0:x1], "RGBA")
    im.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    return x0, y0, x1, y1


def place(key, src, box, W, H, **extra):
    x0, y0, x1, y1 = box
    manifest[key] = dict(src="assets/" + src, x=100 * x0 / W, y=100 * y0 / H,
                         w=100 * (x1 - x0) / W, h=100 * (y1 - y0) / H, **extra)


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
img = load("01-password.jpg", W_HI)
H, W = img.shape[:2]
sh = (H, W)
s = lambda *v: [x * K for x in v]

bub01 = [s(705, 720, 142), s(896, 902, 52), s(1089, 986, 16), s(308, 1225, 40)]
holes = np.zeros(sh, bool)
for cx, cy, r in bub01:
    holes |= disk(sh, cx, cy, r * 1.12)
logo_box = s(1520, 125, 1777, 350)
holes_logo = rect(sh, *logo_box)
bg = inpaint(img, holes | holes_logo)

for i, (cx, cy, r) in enumerate(bub01):
    bubble_sprite(img, bg, cx, cy, r, f"s01_bubble{i}.webp", f"s01_bubble{i}", W, H)

la = np.clip((lum(img) - lum(bg)) / np.maximum(255 - lum(bg), 1) * 1.35, 0, 1) * holes_logo
box = save_rgba(np.full_like(img, 255), la, "s01_logo.webp", crop=logo_box)
place("s01_logo", "s01_logo.webp", box, W, H)

clean = bg  # bubbles + logo removed

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

# the monitor on its own, so it can stay in focus while the meadow blurs during the zoom
mon_mask = ndi.binary_dilation(polygon(sh, [(x * K, y * K) for x, y in mon]), iterations=2)
box = save_rgba(clean, feather(mon_mask, 1.0), "s01_monitor.webp")
place("s01_monitor", "s01_monitor.webp", box, W, H)
box = save_rgba(clean, fg_alpha, "s01_fg.webp", crop=(0, 0, W, H))
place("s01_fg", "s01_fg.webp", box, W, H)

sky = inpaint(clean, ndi.binary_dilation(ground, iterations=8), iters=30)
pad = round(W * 0.06)  # mirrored margin so the clouds can drift sideways
sky = np.pad(sky, ((0, 0), (pad, pad), (0, 0)), mode="reflect")
save_rgb(sky, "s01_sky.jpg", 84)
manifest["s01_sky"] = dict(src="assets/s01_sky.jpg", x=-100 * pad / W, y=0, w=100 + 200 * pad / W, h=100)

orig = Image.open(os.path.join(ROOT, "01-password.jpg")).convert("RGB")
scr = (1514, 616, 1684, 752)
orig.crop(scr).save(os.path.join(OUT, "s01_screen.jpg"), quality=90)
place("s01_screen", "s01_screen.jpg", scr, 3288, 1850)
manifest["s01_input"] = dict(x=100 * 646 / 1600, y=100 * 533 / 900, w=100 * 294 / 1600, h=100 * 75 / 900)

# ---------------------------------------------------------------- screen 02
print("screen 02 ...")
save_rgb(load("02-splash-login-1.jpg", W_HI), "s02_bg.jpg", 86)
manifest["s02_bg"] = dict(src="assets/s02_bg.jpg")
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
for src, out, cur_box, fold_box, key in [
    ("04-journey-00.jpg", "j00", (1004, 536, 1064, 616), (916, 486, 1012, 560), "j00"),
    ("05-new-chapter.jpg", "j05", (1014, 519, 1072, 599), (916, 486, 1012, 560), "j05"),
]:
    im = load(src, W)
    m = rect(sh, *cur_box)
    bg = inpaint(im, m)
    save_rgb(bg, out + "_bg.jpg", 88)
    manifest[key + "_bg"] = dict(src="assets/" + out + "_bg.jpg")
    if key == "j00":
        d = np.abs(im - bg).max(2)
        a = np.clip(d / 60.0, 0, 1) * m
        F = bg + (im - bg) / np.maximum(a, 0.08)[..., None]
        box = save_rgba(F, a, "cursor.webp", crop=cur_box)
        place("cursor", "cursor.webp", box, W, H)
    fb = save_rgba(bg, np.ones(sh, np.float32), out + "_folder.webp", crop=fold_box)
    place(key + "_folder", out + "_folder.webp", fb, W, H)

manifest["j05_cursor"] = dict(x=100 * 1016 / W, y=100 * 524 / H)
save_rgb(load("04-journey-0.jpg", W), "j0_bg.jpg", 88)
manifest["j0_bg"] = dict(src="assets/j0_bg.jpg")

win_box = (194, 244, 1716, 962)
win_mask = rounded_rect(sh, win_box[0], win_box[1], win_box[2] - 1, win_box[3] - 1, 26)
win_alpha = feather(win_mask, 1.0)
for i, src in enumerate([f"04-journey-{n}.jpg" for n in range(6)]):
    im = load(src, W)
    box = save_rgba(im, win_alpha, f"win{i}.webp", crop=win_box, q=90)
    place(f"win{i}", f"win{i}.webp", box, W, H)

shutil.copyfile(os.path.join(ROOT, FLY_SOURCE), os.path.join(OUT, "fly.mp4"))

with open(os.path.join(OUT, "manifest.js"), "w") as f:
    f.write("// generated by scripts/design/prepare_assets.py\nwindow.MANIFEST = ")
    json.dump(manifest, f, indent=1)
    f.write(";\n")
print("done ->", OUT)
