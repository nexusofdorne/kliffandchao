"""Cut the motif tab's pictures from the couple's 3.0 elements.

    python scripts/design/prepare_motif.py [SOURCE]

SOURCE (default: 3.0/elements/04 - motiff) holds two fabric strips ("brown palette.png",
"green palette.png", three fabrics stacked in each) and the outfit cut-outs ("women 1.png" ...,
"men 1.png" ...). Writes
  public/img/motif/fabric-<brown|green>-<1..3>.webp   (square, for the round swatches)
  public/img/motif/<women|men>-<n>.webp               (transparent, 600 px tall)
Offline tooling: Python 3 with Pillow. Re-run after changing the pictures.
"""
import glob
import os
import re
import sys

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(REPO, "3.0", "elements", "04 - motiff")
OUT = os.path.join(REPO, "public", "img", "motif")
SWATCH = 200
FIGURE_H = 600


def fabrics(strip, name):
    im = Image.open(os.path.join(SOURCE, strip)).convert("RGB")
    band = im.height / 3
    for i in range(3):
        side = min(im.width, round(band)) - 8
        cx, cy = im.width / 2, band * (i + 0.5)
        box = (round(cx - side / 2), round(cy - side / 2), round(cx + side / 2), round(cy + side / 2))
        im.crop(box).resize((SWATCH, SWATCH), Image.Resampling.LANCZOS).save(
            os.path.join(OUT, f"fabric-{name}-{i + 1}.webp"), quality=86, method=6)


def figures():
    for path in glob.glob(os.path.join(SOURCE, "*.png")):
        m = re.match(r"(women|men) (\d+)\.png$", os.path.basename(path))
        if not m:
            continue
        im = Image.open(path).convert("RGBA")
        im = im.crop(im.getchannel("A").getbbox())
        w = round(im.width * FIGURE_H / im.height)
        im.resize((w, FIGURE_H), Image.Resampling.LANCZOS).save(
            os.path.join(OUT, f"{m.group(1)}-{m.group(2)}.webp"), quality=86, alpha_quality=90, method=6)
        print(f"{m.group(1)}-{m.group(2)}: {w} x {FIGURE_H}")


def main():
    os.makedirs(OUT, exist_ok=True)
    fabrics("brown palette.png", "brown")
    fabrics("green palette.png", "green")
    figures()


if __name__ == "__main__":
    main()
