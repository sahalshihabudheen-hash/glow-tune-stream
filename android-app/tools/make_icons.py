#!/usr/bin/env python3
"""
Regenerates every logo-based image in the Android app from ONE source file.

    python3 tools/make_icons.py                     # uses branding/app-logo.png
    python3 tools/make_icons.py path/to/logo.png    # or any other logo

Needs:  pip install pillow numpy scipy

Writes (all under app/src/main/):
  res/drawable-*/ic_launcher_foreground.png   adaptive launcher icon (full colour logo)
  res/drawable-xxxhdpi/ic_launcher_monochrome.png   Android 13+ "themed icon" layer (white silhouette)
  res/drawable-xxhdpi/ic_splash_logo.png      splash screen logo
  res/drawable-*/ic_stat_nyra.png             notification status-bar icon (white silhouette)
  assets/logo.png                             logo shown on the offline page

The picking of the clef silhouette (for the two single-colour icons) is tuned for the current
logo: a warm pink/orange treble clef with blue splatter dots on a flat dark background. If you
switch to a very different logo, check the preview PNGs this script writes to tools/preview/.
"""
import pathlib
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / "app/src/main/res"
ASSETS = ROOT / "app/src/main/assets"
PREVIEW = ROOT / "tools/preview"

src_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "branding/app-logo.png"
logo = Image.open(src_path).convert("RGB")
a = np.asarray(logo).astype(int)
H, W = a.shape[:2]
BG = tuple(int(v) for v in a[2, 2])  # flat background colour of the logo (top-left pixel)
print(f"logo {W}x{H}, background #{BG[0]:02X}{BG[1]:02X}{BG[2]:02X}")

# ---- 1. find the clef (largest warm blob) -> smooth silhouette mask --------------------------------
R, G, B = a[..., 0], a[..., 1], a[..., 2]
body = (R > 95) & (R >= B - 15) & (a.max(axis=2) > 120)          # warm/magenta, not the blue splatter
body = ndi.binary_closing(body, structure=np.ones((3, 3)), iterations=4)
body = ndi.binary_fill_holes(body)
lab, n = ndi.label(body)
main = lab == (np.argmax(ndi.sum(body, lab, range(1, n + 1))) + 1)
mask = ndi.binary_fill_holes(ndi.gaussian_filter(main.astype(float), sigma=3.0) > 0.5)  # remove ragged edges
lab, n = ndi.label(mask)
mask = lab == (np.argmax(ndi.sum(mask, lab, range(1, n + 1))) + 1)
ys, xs = np.where(mask)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
CX, CY = (x0 + x1) / 2, (y0 + y1) / 2
CH = y1 - y0 + 1  # clef height in source pixels
print(f"clef bbox {x1 - x0 + 1}x{CH}px, centre ({CX:.0f},{CY:.0f})")
mask_img = Image.fromarray((mask * 255).astype("uint8"), "L")


def place(img, size, scale, mode, fill):
    """Return a size x size canvas with `img` scaled by `scale`, clef centre on the canvas centre."""
    w, h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    scaled = img.resize((w, h), Image.LANCZOS)
    canvas = Image.new(mode, (size, size), fill)
    canvas.paste(scaled, (round(size / 2 - CX * scale), round(size / 2 - CY * scale)))
    return canvas


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)
    print("  wrote", path.relative_to(ROOT))


DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

# ---- 2. adaptive launcher icon: 108dp canvas, clef = 59% of it (inside the 66dp safe zone) ---------
MASTER = 864  # 108dp @ 8x; downsized per density
k_master = 0.59 * MASTER / CH
fg_master = place(logo, MASTER, k_master, "RGB", BG)
for name, d in DENSITY.items():
    save(fg_master.resize((round(108 * d),) * 2, Image.LANCZOS), RES / f"drawable-{name}/ic_launcher_foreground.png")

# ---- 3. themed (monochrome) icon: white clef on transparent, same placement -------------------------
alpha = place(mask_img, 432, 0.59 * 432 / CH, "L", 0)
mono = Image.new("RGBA", alpha.size, (255, 255, 255, 0))
mono.putalpha(alpha)
save(mono, RES / "drawable-xxxhdpi/ic_launcher_monochrome.png")

# ---- 4. splash logo: 288dp box (only the centre 192dp circle is visible) -> same composition at 3x --
save(fg_master.resize((864, 864), Image.LANCZOS), RES / "drawable-xxhdpi/ic_splash_logo.png")

# ---- 5. notification status-bar icon: white silhouette, 24dp, clef 22dp tall -------------------------
for name, d in DENSITY.items():
    size = round(24 * d)
    big = place(mask_img, size * 8, 22 * d * 8 / CH, "L", 0)  # draw big, then shrink = clean anti-aliasing
    al = big.resize((size, size), Image.LANCZOS)
    icon = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    icon.putalpha(al)
    save(icon, RES / f"drawable-{name}/ic_stat_nyra.png")

# ---- 6. offline page logo ----------------------------------------------------------------------------
save(fg_master.resize((256, 256), Image.LANCZOS), ASSETS / "logo.png")

# ---- previews to eyeball the result -------------------------------------------------------------------
PREVIEW.mkdir(parents=True, exist_ok=True)
def circle_mask(s):
    m = Image.new("L", (s, s), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).ellipse([s * 18 / 108, s * 18 / 108, s * 90 / 108, s * 90 / 108], fill=255)  # 72dp visible circle
    return m
prev = Image.new("RGB", (432 * 2 + 30, 432), (60, 60, 60))
ic = fg_master.resize((432, 432), Image.LANCZOS)
prev.paste(ic, (0, 0), circle_mask(432))
sq = Image.new("RGB", (432, 432), (60, 60, 60))
m = Image.new("L", (432, 432), 0)
from PIL import ImageDraw
ImageDraw.Draw(m).rounded_rectangle([432 * 18 / 108, 432 * 18 / 108, 432 * 90 / 108, 432 * 90 / 108], radius=60, fill=255)
sq.paste(ic, (0, 0), m)
prev.paste(sq, (462, 0))
prev.save(PREVIEW / "launcher_preview.png")
print("done")
