#!/usr/bin/env python3
"""汐見環状線3D 用アイコン一括生成スクリプト

downloads/icon_shiomi_platform.png (1024x1024) から
Web(PWA) / Android / Electron 用の各サイズを生成する。
"""
import os
import struct
from PIL import Image, ImageDraw

SRC = os.path.join(os.path.dirname(__file__), "..", "..", "..", "downloads", "icon_shiomi_platform.png")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WEB_ICONS = os.path.join(ROOT, "assets", "icons")
DESKTOP_BUILD = os.path.join(ROOT, "apps", "desktop", "build")
ANDROID_RES = os.path.join(ROOT, "apps", "android", "app", "src", "main", "res")

for d in (WEB_ICONS, DESKTOP_BUILD):
    os.makedirs(d, exist_ok=True)


def save(img, path, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, **kw)
    print("wrote", os.path.relpath(path, ROOT), img.size)


base = Image.open(SRC).convert("RGB")
# 縁の色（マスカブル用の背景）を四隅から拾う
corners = [base.getpixel(p) for p in ((8, 8), (1015, 8), (8, 1015), (1015, 1015))]
bg = tuple(sum(c[i] for c in corners) // len(corners) for i in range(3))
print("background color:", bg)


def scaled(size, img=base):
    return img.resize((size, size), Image.LANCZOS)


def maskable(size, crop_ratio=0.80):
    """マスカブルアイコン：中央80%を切り出して全面に拡大（円形マスクで欠けない）"""
    w, h = base.size
    cw, ch = int(w * crop_ratio), int(h * crop_ratio)
    left, top = (w - cw) // 2, (h - ch) // 2
    cropped = base.crop((left, top, left + cw, top + ch))
    return cropped.resize((size, size), Image.LANCZOS)


def rounded(size, radius_ratio=0.22, circle=False):
    img = scaled(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    if circle:
        d.ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        r = int(size * radius_ratio)
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    img.putalpha(mask)
    return img


# ---- Web / PWA ----
save(scaled(1024), os.path.join(WEB_ICONS, "icon-1024.png"))
save(scaled(512), os.path.join(WEB_ICONS, "icon-512.png"))
save(scaled(192), os.path.join(WEB_ICONS, "icon-192.png"))
save(maskable(512), os.path.join(WEB_ICONS, "maskable-512.png"))
save(maskable(192), os.path.join(WEB_ICONS, "maskable-192.png"))
save(scaled(180), os.path.join(WEB_ICONS, "apple-touch-icon-180.png"))
save(scaled(32), os.path.join(WEB_ICONS, "favicon-32.png"))
save(scaled(16), os.path.join(WEB_ICONS, "favicon-16.png"))
# favicon.ico (16/32/48)
scaled(48).save(os.path.join(WEB_ICONS, "favicon.ico"),
                sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon.ico")

# ---- Electron (Windows / macOS) ----
save(scaled(1024), os.path.join(DESKTOP_BUILD, "icon.png"))
scaled(512).save(os.path.join(DESKTOP_BUILD, "icon.ico"),
                 sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64),
                        (128, 128), (256, 256)])
print("wrote icon.ico")

ICNS_TYPES = [("ic11", 32), ("ic12", 64), ("ic07", 128), ("ic13", 256),
              ("ic08", 256), ("ic14", 512), ("ic09", 512), ("ic10", 1024)]
chunks = b""
import io
for code, size in ICNS_TYPES:
    buf = io.BytesIO()
    scaled(size).save(buf, format="PNG")
    data = buf.getvalue()
    chunks += code.encode("ascii") + struct.pack(">I", len(data) + 8) + data
icns = b"icns" + struct.pack(">I", len(chunks) + 8) + chunks
with open(os.path.join(DESKTOP_BUILD, "icon.icns"), "wb") as f:
    f.write(icns)
print("wrote icon.icns", len(icns), "bytes")

# ---- Android launcher icons ----
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for dpi, size in DENSITIES.items():
    folder = os.path.join(ANDROID_RES, "mipmap-" + dpi)
    save(scaled(size), os.path.join(folder, "ic_launcher.png"))
    save(rounded(size, circle=True), os.path.join(folder, "ic_launcher_round.png"))

# Android adaptive icon foreground / background (API 26+)
FG_DENSITIES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}
for dpi, size in FG_DENSITIES.items():
    folder = os.path.join(ANDROID_RES, "mipmap-" + dpi)
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.64)
    fg.paste(scaled(inner), ((size - inner) // 2, (size - inner) // 2))
    save(fg, os.path.join(folder, "ic_launcher_foreground.png"))
print("done")
