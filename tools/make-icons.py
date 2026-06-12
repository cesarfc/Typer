#!/usr/bin/env python3
"""Generate TypeQuest app icons (a gold T keycap on indigo) as PNGs.

No image libraries needed — writes the PNG format by hand. Outputs:
  img/icon-1024.png  iOS app icon (opaque square; iOS rounds it)
  img/icon-512.png   web manifest
  img/icon-192.png   web manifest
  img/icon-180.png   apple-touch-icon
  ios/TypeQuest/Assets.xcassets/AppIcon.appiconset/icon-1024.png
"""
import os
import struct
import zlib


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def in_round_rect(x, y, cx, cy, hw, hh, r):
    dx, dy = abs(x - cx), abs(y - cy)
    if dx > hw or dy > hh:
        return False
    if dx <= hw - r or dy <= hh - r:
        return True
    return (dx - (hw - r)) ** 2 + (dy - (hh - r)) ** 2 <= r * r


def render(size):
    s = size
    bg_top, bg_bot = (20, 25, 54), (11, 14, 29)          # --bg1 -> --bg0
    gold_top, gold_bot = (255, 223, 107), (245, 185, 22)  # keycap face
    gold_side = (181, 131, 10)                            # keycap depth
    navy = (27, 33, 66)                                   # the T glyph

    cx = s / 2
    face_cy = s * 0.47
    hw = s * 0.30                # keycap half width
    hh = s * 0.27                # keycap half height
    rad = s * 0.085              # keycap corner radius
    depth = s * 0.045            # 3D lip below the face
    # T glyph metrics (relative to the keycap face)
    bar_hw, bar_hh = hw * 0.62, hh * 0.16
    bar_cy = face_cy - hh * 0.42
    stem_hw, stem_hh = hw * 0.16, hh * 0.56
    stem_cy = bar_cy + bar_hh + stem_hh - s * 0.004

    rows = []
    for y in range(s):
        row = bytearray([0])  # filter byte: None
        for x in range(s):
            px = lerp(bg_top, bg_bot, y / (s - 1))
            if in_round_rect(x, y, cx, face_cy + depth, hw, hh, rad):
                px = gold_side
            if in_round_rect(x, y, cx, face_cy, hw, hh, rad):
                t = max(0.0, min(1.0, (y - (face_cy - hh)) / (2 * hh)))
                px = lerp(gold_top, gold_bot, t)
                if (abs(x - cx) <= bar_hw and abs(y - bar_cy) <= bar_hh) or \
                   (abs(x - cx) <= stem_hw and abs(y - stem_cy) <= stem_hh):
                    px = navy
            row.extend(px)
        rows.append(bytes(row))

    raw = b"".join(rows)
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c))
    ihdr = struct.pack(">IIBBBBB", s, s, 8, 2, 0, 0, 0)  # 8-bit RGB
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    outs = {
        os.path.join(root, "img", "icon-1024.png"): 1024,
        os.path.join(root, "img", "icon-512.png"): 512,
        os.path.join(root, "img", "icon-192.png"): 192,
        os.path.join(root, "img", "icon-180.png"): 180,
        os.path.join(root, "ios", "TypeQuest", "Assets.xcassets",
                     "AppIcon.appiconset", "icon-1024.png"): 1024,
    }
    for path, size in outs.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(render(size))
        print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    main()
