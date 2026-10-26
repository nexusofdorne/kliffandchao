"""
Builds the portrait (phone) layers for prototype-mobile/ from the desktop layers.

    python scripts/design/prepare_portrait.py

Reads the desktop scene layers in public/img/scenes/ (written by prepare_assets.py)
and their manifest, config/scene-layers.generated.ts, and writes portrait layers
plus manifest.js to prototype-mobile/assets/. Offline design tooling: needs Python 3
with numpy, scipy and Pillow.

The portrait stage is 1080 x 2340 (9:19.5, a modern phone). How each screen is made:
  01 gate     a centred crop of the hill and monitor at the bottom, the sky stretched
              upward to fill the height; logo and bubbles placed by hand.
  02 terminal the monitor bezel, 9-sliced (corners kept, edges stretched).
  03 intro    the grass ring rebuilt as a tall frame: the four corners as they are,
              the top and bottom bands from the x 1460-1860 slice (which runs straight
              into the right-hand corners), the side bands mirror-tiled from stretches
              without painted-over bubble patches. Each bubble moves with its piece,
              so it still hides the patch under it. The bezel is 9-sliced.
  04 / 05     the same crop the fly-through video gets when it covers a portrait
              screen (x 711-1209 of 1920), so the cut into the clip is invisible.
"""
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUB = os.path.join(REPO, "public")
OUT = os.path.join(REPO, "prototype-mobile", "assets")
os.makedirs(OUT, exist_ok=True)

PW, PH = 1080, 2340
src_ts = open(os.path.join(REPO, "config", "scene-layers.generated.ts"), encoding="utf-8").read()
M = json.loads(src_ts[src_ts.index("= ") + 2 : src_ts.rindex(" as const")])
manifest = {}


def load(key, mode="RGBA"):
    return Image.open(PUB + M[key]["src"]).convert(mode)


def arr(im):
    return np.asarray(im).astype(np.float32)


def save(a, name, q=86):
    a = np.clip(a, 0, 255).astype(np.uint8)
    path = os.path.join(OUT, name)
    if a.shape[2] == 4:
        Image.fromarray(a, "RGBA").save(path, "WEBP", quality=q, method=6)
    else:
        Image.fromarray(a, "RGB").save(path, quality=q)
    return "assets/" + name


def box(key, x, y, w, h, **extra):
    manifest[key] = dict(x=100 * x / PW, y=100 * y / PH, w=100 * w / PW, h=100 * h / PH, **extra)


def sprite(key, im, x, y, scale, name=None, resample=Image.Resampling.LANCZOS):
    """Save a sprite scaled by `scale` and place it with its top-left at (x, y) portrait px."""
    w, h = round(im.width * scale), round(im.height * scale)
    src = save(arr(im.resize((w, h), resample)), name or key + ".webp")
    box(key, x, y, w, h, src=src)


def stage_box(key, W=2560, H=1440):
    d = M[key]
    return d["x"] * W / 100, d["y"] * H / 100, d["w"] * W / 100, d["h"] * H / 100


def feather_blend(pieces, shape):
    """Weighted blend of RGBA pieces: (array, x, y, weight array). Premultiplied average."""
    H, W = shape
    acc = np.zeros((H, W, 3), np.float32)
    aw = np.zeros((H, W), np.float32)
    ww = np.zeros((H, W), np.float32)
    for a, x, y, w in pieces:
        h, wd = a.shape[:2]
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(W, x + wd), min(H, y + h)
        sa = a[y0 - y : y1 - y, x0 - x : x1 - x]
        sw = w[y0 - y : y1 - y, x0 - x : x1 - x]
        al = sa[..., 3] / 255.0
        acc[y0:y1, x0:x1] += sa[..., :3] * (al * sw)[..., None]
        aw[y0:y1, x0:x1] += al * sw
        ww[y0:y1, x0:x1] += sw
    rgb = acc / np.maximum(aw, 1e-6)[..., None]
    alpha = aw / np.maximum(ww, 1e-6)
    return np.dstack([rgb, alpha * 255])


def ramp(h, w, left=0, right=0, top=0, bottom=0):
    """Weights that fall to ~0 over `n` px on the given sides, for seam overlaps."""
    wx = np.ones(w, np.float32)
    wy = np.ones(h, np.float32)
    if left:
        wx[:left] = np.linspace(0.02, 1, left)
    if right:
        wx[w - right :] = np.linspace(1, 0.02, right)
    if top:
        wy[:top] = np.linspace(0.02, 1, top)
    if bottom:
        wy[h - bottom :] = np.linspace(1, 0.02, bottom)
    return np.outer(wy, wx)


def mirror_tile(a, height):
    """Repeat `a` vertically, every other copy flipped, so each join is seamless."""
    out, flip = [], False
    while sum(p.shape[0] for p in out) < height:
        out.append(a[::-1] if flip else a)
        flip = not flip
    return np.concatenate(out, 0)[:height]


def resize(a, w, h):
    mode = "RGBA" if a.shape[2] == 4 else "RGB"
    im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), mode)
    return arr(im.resize((w, h), Image.Resampling.LANCZOS))


# ------------------------------------------------------------------ the 9-slice frame
# columns and rows in desktop px (2560 x 1440) and the scale they are drawn at
K = 0.6
XL, XC0, XC1, XR = 700, 1460, 1860, 1860  # left col 0..700, centre 1460..1860, right 1860..2560
YT, YB = 500, 940  # top row 0..500, bottom row 940..1440
OV = 24  # seam overlap, portrait px
BL_X, BC_X0 = 330, 1090  # bottom row: left corner 0..330, then 1090..1860 (fills to the right corner)


def frame(a, mid_left, mid_right, stretch=False):
    """a: desktop RGBA (1440, 2560). mid_left/right: source y ranges for the side bands."""
    k = lambda v: round(v * K)
    cw, ch = k(XL), k(YT)  # corner size: 420 x 300
    mid_w = PW - 2 * cw  # 240
    mid_h = PH - 2 * ch  # 1740
    pieces = []
    o = round(OV / K)  # overlap in source px

    def piece(x0, y0, x1, y1, px, py, l=0, r=0, t=0, b=0):
        sub = a[max(0, y0) : y1, max(0, x0) : x1]
        sub = resize(sub, k(sub.shape[1]), k(sub.shape[0]))
        pieces.append((sub, px, py, ramp(*sub.shape[:2], left=l, right=r, top=t, bottom=b)))

    # corners
    piece(0, 0, XL + o, YT + o, 0, 0, r=OV, b=OV)
    piece(XR, 0, 2560, YT + o, PW - cw, 0, b=OV)
    # bottom-left: a narrow corner and a wide slice from just left of the hill, so the
    # hill line runs on across the join instead of stepping
    bl = round(BL_X * K)
    piece(0, YB - o, BL_X + o, 1440, 0, PH - ch - OV, r=OV, t=OV)
    piece(BC_X0 - o, YB, XC1, 1440, bl - OV, PH - ch, l=OV)
    piece(XR, YB - o, 2560, 1440, PW - cw, PH - ch - OV, t=OV)
    # top and bottom bands: the centre slice runs straight into the right corners
    piece(XC0 - o, 0, XC1, YT, cw - OV, 0, l=OV, r=OV)
    # side bands, tiled to the height
    for (y0, y1), (x0, x1), px in [(mid_left, (0, XL), 0), (mid_right, (XR, 2560), PW - cw)]:
        band = a[y0:y1, x0:x1]
        band = resize(band, k(band.shape[1]), k(band.shape[0]))
        tall = (resize(band, band.shape[1], mid_h + 2 * OV) if stretch else mirror_tile(band, mid_h + 2 * OV))
        pieces.append((tall, px, ch - OV, ramp(*tall.shape[:2], top=OV, bottom=OV)))
    return feather_blend(pieces, (PH, PW))


def frame_point(x, y):
    """Where a desktop point inside a corner, a band or the first side tile lands."""
    k = K
    cw, ch = round(XL * k), round(YT * k)
    if y >= YB and BC_X0 <= x < XC1:
        px = round(BL_X * k) + (x - BC_X0) * k
    elif y >= YB and BL_X <= x < BC_X0:
        return None
    elif XC0 <= x < XC1:
        px = cw + (x - XC0) * k
    elif x < XL:
        px = x * k
    elif x >= XR:
        px = PW - cw + (x - XR) * k
    else:
        return None
    if y < YT:
        py = y * k
    elif y >= YB:
        py = PH - ch + (y - YB) * k
    else:
        return None
    return px, py


# ------------------------------------------------------------------ 03 intro frame
print("03 ...")
W03, H03 = 2560, 1440
grass = np.zeros((H03, W03, 4), np.float32)
grass_img = Image.new("RGBA", (W03, H03))
for key in ["s03_grass_left", "s03_grass_top", "s03_grass_right", "s03_grass_bottom"]:
    x, y, _, _ = stage_box(key)
    grass_img.alpha_composite(load(key), (round(x), round(y)))
flowers_img = Image.new("RGBA", (W03, H03))
x, y, _, _ = stage_box("s03_flowers")
flowers_img.alpha_composite(load("s03_flowers"), (round(x), round(y)))
bezel_img = load("s03_bezel")

# side bands chosen clear of the painted-over bubble patches
LEFT_BAND, RIGHT_BAND = (500, 800), (500, 860)
g = frame(arr(grass_img), LEFT_BAND, RIGHT_BAND)
f = frame(arr(flowers_img), LEFT_BAND, RIGHT_BAND)
bz = frame(arr(bezel_img), (520, 920), (520, 920), stretch=True)
# keep the bezel's alpha crisp (it's a hard plastic edge)
bz[..., 3] = np.where(bz[..., 3] > 127, 255, bz[..., 3] * 0.5)

# split the grass into four pieces by angle, so they can surface from each side
yy, xx = np.mgrid[:PH, :PW].astype(np.float32)
ang = np.degrees(np.arctan2((yy - PH * 0.5) / PH, (xx - PW * 0.5) / PW))
sectors = {"top": (ang >= -135) & (ang < -45), "right": (ang >= -45) & (ang < 45),
           "bottom": (ang >= 45) & (ang < 135), "left": (ang >= 135) | (ang < -135)}
for name, m in sectors.items():
    soft = np.clip(1 - ndi.distance_transform_edt(~m) / 24, 0, 1)
    soft = np.maximum(soft, ndi.binary_dilation(m, iterations=2))
    piece = g.copy()
    piece[..., 3] *= soft
    ys, xs = np.where(piece[..., 3] > 2)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    src = save(piece[y0:y1, x0:x1], f"p03_grass_{name}.webp", q=84)
    box(f"p03_grass_{name}", x0, y0, x1 - x0, y1 - y0, src=src)
ys, xs = np.where(f[..., 3] > 2)
x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
box("p03_flowers", x0, y0, x1 - x0, y1 - y0, src=save(f[y0:y1, x0:x1], "p03_flowers.webp", q=84))
box("p03_bezel", 0, 0, PW, PH, src=save(bz, "p03_bezel.webp", q=86))
box("p03_interior", 31, 20, PW - 62, PH - 40)

# bubbles move with their piece; a few extra ones dress the tall sides
bub = []
for i in range(12):
    key = f"s03_bubble{i}"
    x, y, w, h = stage_box(key)
    p = frame_point(x + w / 2, y + h / 2)
    if p:
        bub.append((key, p[0] - w * K / 2, p[1] - h * K / 2, K))
extra = [("s03_bubble8", 640, 46, 0.62), ("s03_bubble2", 104, 40, 0.7), ("s03_bubble7", 860, 1060, 0.5), ("s03_bubble11", 40, 1500, 0.42), ("s03_bubble3", 930, 1640, 0.8),
         ("s03_bubble1", 120, 760, 0.8)]
bub += [(k_, x, y, s) for k_, x, y, s in extra]
for n, (key, x, y, s) in enumerate(bub):
    sprite(f"p03_bubble{n}", load(key), x, y, s)
manifest["p03_bubbles"] = len(bub)

# ------------------------------------------------------------------ 02 terminal bezel
print("02 ...")
s02 = arr(load("s02_bg", "RGBA"))
bz2 = frame(s02, (520, 920), (520, 920), stretch=True)
# the centre column of the middle rows is the black screen
bz2[..., :3] = np.where(bz2[..., 3:4] < 1, 0, bz2[..., :3])
bz2[..., 3] = 255
bz2_rgb = bz2[..., :3]
cw, ch = round(XL * K), round(YT * K)
bz2_rgb[ch : PH - ch, cw : PW - cw] = 0
box("p02_bg", 0, 0, PW, PH, src=save(bz2_rgb, "p02_bg.jpg", q=86))
x, y, w, h = stage_box("s02_screen")
box("p02_screen", round(x * K), round(y * K), PW - round(x * K) - round((2560 - x - w) * K),
    PH - round(y * K) - round((1440 - y - h) * K))

# ------------------------------------------------------------------ 01 gate
print("01 ...")
CX0, CX1 = 730, 1830  # centred crop of the hill and the monitor (desktop px)
k1 = PW / (CX1 - CX0)
top = PH - round(1440 * k1)  # the ground sits at the bottom
fg = load("s01_fg")
fgc = fg.crop((CX0, 0, CX1, 1440)).resize((PW, PH - top), Image.Resampling.LANCZOS)
fg_full = Image.new("RGBA", (PW, PH))
fg_full.alpha_composite(fgc, (0, top))
box("p01_fg", 0, 0, PW, PH, src=save(arr(fg_full), "p01_fg.webp", q=84))
# the sky: a wider crop (room to drift) at the same scale as the ground, with a painted
# extension above it: a gradient continuing the sky's own top row, deepening upward,
# and clouds lifted from the right-hand sky of the plate
sky = load("s01_sky", "RGB")
pad = 60
sx0 = CX0 + round(-M["s01_sky"]["x"] * 2560 / 100) - pad
sky_c = sky.crop((sx0, 0, sx0 + (CX1 - CX0) + 2 * pad, 1440))
sw = round(sky_c.width * k1)
lower = arr(sky_c.resize((sw, PH - top), Image.Resampling.LANCZOS))
seam = ndi.gaussian_filter1d(lower[:6].mean(0), 220, axis=0, mode="nearest")  # the sky's top row, smoothed
t = np.linspace(1, 0, top)[:, None, None]  # 1 at the very top, 0 at the seam
deep = seam * np.array([0.78, 0.86, 0.98])  # a deeper blue overhead
ext = seam[None] * (1 - t) + deep[None] * t
# clouds: how much brighter than the local sky each pixel of the plate's upper right is
src_c = arr(sky.crop((2050, 0, 2868, 620)))
base = ndi.gaussian_filter(src_c, (60, 60, 0))
cloud = np.clip((src_c.mean(2) - base.mean(2) - 4) / 40, 0, 1)
cloud = ndi.gaussian_filter(cloud, 1.2)
ch_, cw_ = round(620 * 0.95), round(818 * 0.95)
cloud = np.asarray(Image.fromarray((cloud * 255).astype(np.uint8)).resize((cw_, ch_), Image.Resampling.LANCZOS)) / 255.0
cx, cy = sw - cw_ + 40, 40  # top right, as in the desktop sky
region = ext[cy : cy + ch_, cx : cx + cw_]
hh, ww = region.shape[:2]
a = cloud[:hh, :ww, None] * np.clip(np.linspace(1.4, 0, hh), 0, 1)[:, None, None]  # fade before the seam
a = a * np.clip(np.linspace(0, 4, ww), 0, 1)[None, :, None]  # and in from the left, no hard edge
ext[cy : cy + hh, cx : cx + ww] = region * (1 - a) + np.array([238, 243, 247]) * a
sky_p = np.concatenate([ext, lower], 0)
# blend the seam
blend = 40
w_ = np.linspace(0, 1, 2 * blend)[:, None, None]
sky_p[top : top + 2 * blend] = ext[-1:] * (1 - w_) + lower[: 2 * blend] * w_
box("p01_sky", -pad * k1, 0, sw, PH, src=save(sky_p, "p01_sky.jpg", q=84))


def map01(key):
    x, y, w, h = stage_box(key)
    return (x - CX0) * k1, y * k1 + top, w * k1, h * k1


for key in ["s01_monitor"]:
    x, y, w, h = map01(key)
    sprite("p01_monitor", load(key), x, y, k1)
x, y, w, h = stage_box("s01_screen", 3288, 1850)
xs_, ys_, ws_, hs_ = x * 2560 / 3288, y * 1440 / 1850, w * 2560 / 3288, h * 1440 / 1850
box("p01_screen", (xs_ - CX0) * k1, ys_ * k1 + top, ws_ * k1, hs_ * k1,
    src=save(arr(load("s01_screen", "RGB")), "p01_screen.jpg", q=90))
logo = load("s01_logo")
sprite("p01_logo", logo, (PW - logo.width * 1.05) / 2, 150, 1.05)
for n, (key, x, y, s) in enumerate([("s01_bubble0", 40, 640, 0.9), ("s01_bubble1", 330, 980, 1.0),
                                    ("s01_bubble2", 860, 820, 1.3), ("s01_bubble3", 900, 1240, 1.1)]):
    sprite(f"p01_bubble{n}", load(key), x, y, s)
# where the live heading, subtitle and pill go (portrait px)
mon = manifest["p01_monitor"]
mon_bottom = (mon["y"] + mon["h"]) * PH / 100
manifest["p01_heading"] = dict(cy=100 * (mon_bottom + 105) / PH)
manifest["p01_subtitle"] = dict(cy=100 * (mon_bottom + 175) / PH)
box("p01_input", 210, mon_bottom + 225, 660, 116)

# ------------------------------------------------------------------ 04 / 05
print("04 / 05 ...")
VX0, VX1 = 711, 1209  # what a 1920x1080 clip covering 1080x2340 shows
k4 = PW / (VX1 - VX0)
for key, name in [("j00_bg", "p04_bg.jpg"), ("j05_bg", "p05_bg.jpg")]:
    im = load(key, "RGB").crop((VX0, 0, VX1, 1080)).resize((PW, round(1080 * k4)), Image.Resampling.LANCZOS)
    im = im.crop((0, 0, PW, PH))
    box(key.replace("j00", "p04").replace("j05", "p05"), 0, 0, PW, PH, src=save(arr(im), name, q=86))


def map04(key):
    x, y, w, h = stage_box(key, 1920, 1080)
    return (x - VX0) * k4, y * k4


for key, out in [("j00_folder", "p04_folder"), ("j05_folder", "p05_folder"), ("cursor", "p04_cursor")]:
    x, y = map04(key)
    name = out + "-v2.webp" if out.endswith("_folder") else None  # renamed when the labels became text
    sprite(out, load(key), x, y, k4, name=name, resample=Image.Resampling.NEAREST)
x, y = (M["j05_cursor"]["x"] * 1920 / 100 - VX0) * k4, M["j05_cursor"]["y"] * 1080 / 100 * k4
box("p05_cursor", x, y, manifest["p04_cursor"]["w"] * PW / 100, manifest["p04_cursor"]["h"] * PH / 100)

with open(os.path.join(OUT, "manifest.js"), "w", encoding="utf-8") as fh:
    fh.write("// generated by scripts/design/prepare_portrait.py\nwindow.MANIFEST = ")
    json.dump(manifest, fh, indent=1)
    fh.write(";\n")
print("done ->", OUT)
