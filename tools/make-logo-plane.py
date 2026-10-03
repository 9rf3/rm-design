#!/usr/bin/env python3
"""Key the black background out of the glossy paper-plane source into a
transparent PNG for the nav logo.

usage: python3 tools/make-logo-plane.py [source.png]
default source: ~/Downloads/Glossy Blue Paper Plane Icon.png
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'img', 'logo-plane.png')

LO, HI = 110, 180  # alpha ramp on the max colour channel
OUT_H = 240


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
        '~/Downloads/Glossy Blue Paper Plane Icon.png')
    rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)

    # background is pure black + additive glow -> alpha from brightness
    alpha = np.clip((rgb.max(axis=2) - LO) / (HI - LO), 0, 1)
    colour = np.clip(rgb / np.maximum(alpha, 0.02)[..., None], 0, 255)

    im = Image.fromarray(
        np.dstack([colour, alpha * 255]).astype(np.uint8), 'RGBA')

    ys, xs = np.where(alpha > 0.06)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    im = im.resize((round(im.width * OUT_H / im.height), OUT_H), Image.LANCZOS)

    im.save(DST, optimize=True)
    print('wrote %s  %dx%d' % (DST, im.width, im.height))


if __name__ == '__main__':
    main()
