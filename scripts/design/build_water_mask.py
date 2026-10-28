"""The river's water as a soft greyscale mask, for the world's water shader (lib/world-gl).

    python scripts/design/build_water_mask.py

Same test as build_world.py's ripple highlights: inside the river's outline, minus anything
green (banks, reeds, the island). Writes the mask in the desktop stage's frame (the whole
painting) and in the phone stage's frame (the portrait crop around the vanishing point):
  public/img/world/w_water.png
  prototype-mobile/assets/world/w_water.png
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(__file__))
from build_world import P_SHOW, ROOT, SCENES, H, W  # noqa: E402


# a wider outline than build_world's (it takes in the water either side of the island), and the island
OUTLINE = [(540, 712), (780, 700), (1070, 700), (1250, 700), (1330, 712), (1250, 790), (1190, 850), (1300, 890),
           (1480, 910), (1460, 1000), (1420, 1080), (480, 1080), (520, 1010), (640, 950), (740, 935), (780, 900),
           (650, 860), (560, 790)]
# the island's reflection is green too, but it is water and should ripple
REFLECTION = [(770, 760), (1060, 760), (1040, 805), (800, 805)]
ISLAND = [(750, 700), (800, 668), (900, 650), (1000, 655), (1072, 690), (1068, 758), (750, 762)]


def water_mask(cfg):
    a = np.asarray(Image.open(os.path.join(ROOT, cfg["src"])).convert("RGB").resize((W, H)), np.float32) / 255
    pm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(pm).polygon(OUTLINE, fill=255)
    inside = np.asarray(pm) > 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenish = (g > b + 0.03) & (g > r + 0.02)
    # the island's bush is pale with flowers, so the colour test misses it: cut it out by hand
    # (above its waterline only, so its reflection still ripples)
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).polygon(ISLAND, fill=255)
    island = np.asarray(im) > 0
    rm = Image.new("L", (W, H), 0)
    ImageDraw.Draw(rm).polygon(REFLECTION, fill=255)
    reflection = np.asarray(rm) > 0
    water = (inside & ~greenish & ~island) | reflection
    water = ndi.binary_closing(ndi.binary_opening(water, iterations=2), iterations=6)
    # soft edge so ripples fade out before the banks instead of stopping on a line
    soft = ndi.gaussian_filter(water.astype(np.float32), 4)
    return np.clip((soft - 0.15) / 0.7, 0, 1)


def main():
    cfg = SCENES["w"]
    m = water_mask(cfg)
    desk = Image.fromarray((m * 255 + 0.5).astype(np.uint8), "L").resize((960, 540), Image.Resampling.LANCZOS)
    out = os.path.join(ROOT, "public", "img", "world", "w_water.png")
    desk.save(out, optimize=True)
    print("wrote", out, os.path.getsize(out) // 1024, "KB")
    vx = cfg["vp"][0]
    crop = m[:, vx - P_SHOW: vx + P_SHOW]
    phone = Image.fromarray((crop * 255 + 0.5).astype(np.uint8), "L").resize((250, 540), Image.Resampling.LANCZOS)
    pout = os.path.join(ROOT, "prototype-mobile", "assets", "world", "w_water.png")
    phone.save(pout, optimize=True)
    print("wrote", pout, os.path.getsize(pout) // 1024, "KB")


if __name__ == "__main__":
    main()
