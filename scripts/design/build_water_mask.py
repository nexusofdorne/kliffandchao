"""The water in both paintings as a soft greyscale mask, for the world's water shader (lib/world-gl).

    python scripts/design/build_water_mask.py

The outlines are build_world.py's (the streams beside the journey's path; the wedding hall's pool
and the lake through its window), minus anything green (moss, banks, islands). Writes the mask in
the desktop stage's frame (the whole painting) and in the phone stage's frame (the portrait crop
around the vanishing point):
  public/img/world/<j|w>_water-v5.png
  prototype-mobile/assets/world/<j|w>_water-v5.png
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
from build_world import P_SHOW, ROOT, SCENES, H, W  # noqa: E402

# its own revision: the journey's mask was redrawn clear of the path (media is cached for a week)
REV = "-v5"


STONE_WARMTH = {"journey": 0.03, "wedding": 0.08}


def water_mask(cfg):
    a = np.asarray(Image.open(os.path.join(ROOT, cfg["src"])).convert("RGB").resize((W, H)), np.float32) / 255
    pm = Image.new("L", (W, H), 0)
    for outline in cfg["water"]:
        ImageDraw.Draw(pm).polygon(outline, fill=255)
    inside = np.asarray(pm) > 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenish = (g > b + 0.06) & (g > r + 0.02)
    # the path's and the floor's stone is warmer than water reflecting a pale sky; the hall's
    # lake is warm too, so its floor takes a stricter test
    stone = (a.mean(2) > 0.45) & (r - b > STONE_WARMTH[cfg["name"]])
    water = inside & ~greenish & ~stone
    if cfg["name"] == "journey":
        # keep the ripples well clear of the path: near its edge they pulled the paving into the
        # water and made the path itself look as if it moved
        path = (a.mean(2) > 0.62) & (np.abs(r - b) < 0.06)
        path = ndi.binary_opening(path, iterations=3)
        water &= ~ndi.binary_dilation(path, iterations=14)
    if cfg.get("window"):
        # the lake is only what shows through the round window
        (cx, cy), radius = cfg["window"]
        yy, xx = np.mgrid[0:H, 0:W]
        beyond = (xx - cx) ** 2 + (yy - cy) ** 2 < (radius - 8) ** 2
        pool = yy > cy + radius
        water &= beyond | pool
        # the pool's reflections of the plants are water too
        water |= inside & pool & ~stone
    water = ndi.binary_closing(ndi.binary_opening(water, iterations=2), iterations=6)
    # soft edge so ripples fade out before the banks instead of stopping on a line
    soft = ndi.gaussian_filter(water.astype(np.float32), 4)
    return np.clip((soft - 0.15) / 0.7, 0, 1)


def main():
    for key, cfg in SCENES.items():
        m = water_mask(cfg)
        name = f"{key}_water{REV}.png"
        desk = Image.fromarray((m * 255 + 0.5).astype(np.uint8)).resize((960, 540), Image.Resampling.LANCZOS)
        out = os.path.join(ROOT, "public", "img", "world", name)
        desk.save(out, optimize=True)
        print("wrote", out, os.path.getsize(out) // 1024, "KB")
        vx = cfg["vp"][0]
        crop = m[:, vx - P_SHOW: vx + P_SHOW]
        phone = Image.fromarray((crop * 255 + 0.5).astype(np.uint8)).resize((250, 540), Image.Resampling.LANCZOS)
        pout = os.path.join(ROOT, "prototype-mobile", "assets", "world", name)
        phone.save(pout, optimize=True)
        print("wrote", pout, os.path.getsize(pout) // 1024, "KB")


if __name__ == "__main__":
    main()
