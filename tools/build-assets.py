#!/usr/bin/env python3
"""ticketsale.uz asset pack -> PNG only (transparent background, no labels)."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PNG = os.path.join(ROOT, 'assets', 'png')
IMG = os.path.join(ROOT, 'img')
SHEET = os.path.join(ROOT, 'assets', 'asset-sheet.png')
os.makedirs(PNG, exist_ok=True)

CYAN = (55, 212, 255)
ICE = (214, 245, 255)
WHITE = (255, 255, 255)
GLOW = (30, 168, 255)
BRAND = (4, 105, 250)


# ---------------------------------------------------------------- helpers
def blur(a, r):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'L')
    if r > 0:
        img = img.filter(ImageFilter.GaussianBlur(r))
    return np.asarray(img, dtype=np.float32) / 255.0


def ramp(mask, lo, hi, gamma=0.7):
    t = np.clip(mask, 0, 1)
    k = np.power(t, gamma)[..., None]
    rgb = np.asarray(lo, np.float32) + (np.asarray(hi, np.float32) - np.asarray(lo, np.float32)) * k
    out = np.zeros(t.shape + (4,), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = (t * 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def canvas(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def flat(w, h, rgb, a):
    return ramp(np.full((h, w), a, np.float32), rgb, rgb, 1.0)


def over(base, layer):
    base.alpha_composite(layer)
    return base


def radial(w, h, cx, cy, rx, ry, falloff=2.0, peak=1.0):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((x - cx) / max(rx, 1e-6)) ** 2 + ((y - cy) / max(ry, 1e-6)) ** 2)
    return np.clip(1.0 - d, 0, 1) ** falloff * peak


def hstops(w, stops):
    xs = np.linspace(0, 1, w, dtype=np.float32)
    p = np.array([s[0] for s in stops], np.float32)
    v = np.array([s[1] for s in stops], np.float32)
    return np.interp(xs, p, v).astype(np.float32)


def ss(draw_fn, w, h, s=2):
    m = Image.new('L', (w * s, h * s), 0)
    draw_fn(ImageDraw.Draw(m), s)
    m = m.resize((w, h), Image.LANCZOS)
    return np.asarray(m, dtype=np.float32) / 255.0


def strokes(segs, width, s=1):
    """build a draw() closure: segs = ('line', pts) | ('arc', bbox, a0, a1)"""
    def draw(d, _s=None):
        for seg in segs:
            if seg[0] == 'line':
                pts = [(x * s, y * s) for x, y in seg[1]]
                d.line(pts, fill=255, width=max(1, int(round(width * s))), joint='curve')
            else:
                _, bbox, a0, a1 = seg
                d.arc([bbox[0] * s, bbox[1] * s, bbox[2] * s, bbox[3] * s],
                      a0, a1, fill=255, width=max(1, int(round(width * s))))
    return draw


def line_glow(m, img, glow=((34, 0.55), (11, 0.75), (3, 1.0)), lo=GLOW, hi=ICE, core=ICE):
    g = np.zeros_like(m)
    for r, amt in glow:
        g = np.clip(g + blur(m, r) * amt, 0, 1)
    over(img, ramp(g, lo, hi, 1.3))
    over(img, ramp(m, core, WHITE, 0.55))


def save(img, name):
    p = os.path.join(PNG, name)
    img.save(p)
    return p


def streak(w, h, cy, fwhm, xstops, peak=1.0):
    yy = np.arange(h, dtype=np.float32)[:, None]
    sigma = max(fwhm / 2.355, 0.45)
    prof = np.exp(-0.5 * ((yy - cy) / sigma) ** 2)
    return np.clip(prof * hstops(w, xstops)[None, :] * peak, 0, 1)


# ---------------------------------------------------------------- vehicles
VEHICLES = [
    ('plane-nav.png', 'plane'),
    ('train-nav.png', 'train'),
    ('autobus-nav.png', 'bus'),
]


def vehicle(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im, np.float32) / 255.0
    alpha = a[..., 3]
    lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    veil = (alpha < 0.22) & (lum < 0.42)          # leftover dark backdrop haze
    out = alpha.copy()
    out[veil] = 0.0
    out = np.clip((out - 0.055) / 0.945, 0, 1)     # drop the low-alpha floor
    rgba = np.zeros_like(a)
    rgba[..., :3] = a[..., :3]
    rgba[..., 3] = out
    return Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA')


# ---------------------------------------------------------------- nav track
def nav_track(w=2800, h=340):
    s = 2

    def draw(d, _s=None):
        d.rounded_rectangle([40 * s, 40 * s, (w - 40) * s, (h - 40) * s],
                            radius=130 * s, outline=255, width=5 * s)
        d.rounded_rectangle([64 * s, 64 * s, (w - 64) * s, (h - 64) * s],
                            radius=106 * s, outline=255, width=4 * s)

    m = ss(draw, w, h, s)
    img = canvas(w, h)
    line_glow(m, img, glow=((46, 0.5), (14, 0.7), (4, 1.0)), lo=GLOW, hi=CYAN)

    dots = [(400, 40), (900, 40), (1400, 40), (1900, 40), (2400, 40),
            (650, 300), (1150, 300), (1650, 300), (2150, 300),
            (40, 170), (2760, 170)]
    yy, xx = np.mgrid[0:h, 0:w]
    dm = np.zeros((h, w), np.float32)
    halo = np.zeros((h, w), np.float32)
    for cx, cy in dots:
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        dm = np.maximum(dm, np.clip(1 - d / 7.0, 0, 1) ** 0.45)
        halo = np.maximum(halo, radial(w, h, cx, cy, 42, 42, 2.6, 1.0))
    over(img, ramp(blur(halo, 9) * 0.95, GLOW, CYAN, 1.4))
    over(img, ramp(blur(dm, 3.2), CYAN, WHITE, 0.7))
    over(img, ramp(dm, ICE, WHITE, 0.4))
    return img


# ---------------------------------------------------------------- corners
def corner(name, w, h, segs, width=4):
    m = ss(strokes(segs, width, 2), w, h, 2)
    img = canvas(w, h)
    line_glow(m, img, glow=((30, 0.5), (10, 0.7), (3, 1.0)), lo=GLOW, hi=CYAN)
    return save(img, name)


def build_corners():
    # 01 : 90 deg bend, tail down + tail right
    c1 = [line := ('line', [(130, 430), (130, 390)]),
          ('arc', (130, 130, 650, 650), 180, 270),
          ('line', [(390, 130), (430, 130)]),
          ('line', [(160, 430), (160, 390)]),
          ('arc', (150, 150, 630, 630), 180, 270),
          ('line', [(390, 160), (430, 160)])]
    corner('track-corner-01.png', 460, 460, c1, 4)
    # 02 : mirrored
    im = Image.open(os.path.join(PNG, 'track-corner-01.png')).transpose(Image.FLIP_LEFT_RIGHT)
    im.save(os.path.join(PNG, 'track-corner-02.png'))
    # 03 : s bend
    c3 = [('line', [(30, 120), (130, 120)]),
          ('arc', (50, 140, 210, 300), 270, 360),
          ('arc', (210, 140, 370, 300), 90, 180),
          ('line', [(370, 300), (430, 300)]),
          ('line', [(30, 138), (130, 138)]),
          ('arc', (68, 158, 192, 282), 270, 360),
          ('arc', (192, 52, 388, 248), 90, 180),
          ('line', [(370, 318), (430, 318)])]
    corner('track-corner-03.png', 460, 400, c3, 4)
    # 04 : hairpin
    c4 = [('arc', (50, 40, 310, 300), 180, 360),
          ('line', [(50, 170), (50, 450)]),
          ('line', [(310, 170), (310, 450)]),
          ('arc', (68, 58, 292, 282), 180, 360),
          ('line', [(68, 170), (68, 450)]),
          ('line', [(292, 170), (292, 450)])]
    corner('track-corner-04.png', 360, 480, c4, 4)
    # straight segment
    c5 = [('line', [(24, 32), (416, 32)]),
          ('line', [(24, 54), (416, 54)])]
    m = ss(strokes(c5, 4, 2), 440, 86, 2)
    img = canvas(440, 86)
    line_glow(m, img, glow=((30, 0.5), (10, 0.7), (3, 1.0)), lo=GLOW, hi=CYAN)
    yy, xx = np.mgrid[0:86, 0:440]
    d = np.sqrt((xx - 220) ** 2 + (yy - 32) ** 2)
    dm = np.clip(1 - d / 7.0, 0, 1) ** 0.45
    halo = radial(440, 86, 220, 32, 40, 40, 2.6, 1.0)
    over(img, ramp(blur(halo, 9) * 0.95, GLOW, CYAN, 1.4))
    over(img, ramp(blur(dm, 3.2), CYAN, WHITE, 0.7))
    over(img, ramp(dm, ICE, WHITE, 0.4))
    save(img, 'track-line.png')


# ---------------------------------------------------------------- trails
def trail(name, w, h, specs, glow_r=16, glow_amt=0.8):
    acc = np.zeros((h, w), np.float32)
    for s in specs:
        acc = np.maximum(acc, streak(w, h, **s))
    g = blur(acc, glow_r)
    alpha = np.clip(acc + g * glow_amt, 0, 1)
    img = ramp(alpha, GLOW, ICE, 0.72)
    core = np.clip((acc - 0.5) / 0.5, 0, 1)
    if core.max() > 0:
        img = over(img, ramp(blur(core, 1.4), ICE, WHITE, 0.45))
    return save(img, name)


def build_trails():
    warm = [(0, 0), (0.5, 0.45), (0.84, 1), (1, 1)]
    short = [(0, 0), (0.42, 0.4), (0.8, 1), (1, 1)]
    trail('motion-trail-01.png', 800, 100, [
        dict(cy=50, fwhm=17, xstops=warm, peak=1.0),
        dict(cy=30, fwhm=5, xstops=[(0, 0), (0.55, 0.3), (0.88, 0.85), (1, 0.9)]),
        dict(cy=70, fwhm=6, xstops=[(0, 0), (0.5, 0.28), (0.86, 0.8), (1, 0.85)]),
    ])
    trail('motion-trail-02.png', 520, 84, [
        dict(cy=42, fwhm=22, xstops=short, peak=1.0),
        dict(cy=22, fwhm=5, xstops=[(0, 0), (0.5, 0.35), (0.9, 1), (1, 1)]),
    ])
    trail('motion-trail-03.png', 700, 92, [
        dict(cy=30, fwhm=5, xstops=warm, peak=1.0),
        dict(cy=46, fwhm=9, xstops=[(0, 0), (0.45, 0.5), (0.85, 1), (1, 1)]),
        dict(cy=62, fwhm=4, xstops=[(0, 0), (0.6, 0.4), (0.9, 0.9), (1, 0.95)]),
    ])
    trail('motion-trail-04.png', 600, 70, [
        dict(cy=35, fwhm=26, xstops=[(0, 0), (0.4, 0.5), (0.8, 1), (1, 1)], peak=0.9),
        dict(cy=35, fwhm=7, xstops=[(0.1, 0), (0.55, 0.5), (0.9, 1), (1, 1)]),
    ], glow_r=22)


# ---------------------------------------------------------------- lights
def light(name, w, h, kind):
    img = canvas(w, h)
    cx, cy = w / 2, h / 2
    if kind == 'dot':
        halo = radial(w, h, cx, cy, w * 0.42, h * 0.42, 2.8, 1.0)
        core = radial(w, h, cx, cy, w * 0.11, h * 0.11, 0.4, 1.0)
        mid = radial(w, h, cx, cy, w * 0.2, h * 0.2, 0.8, 1.0)
    elif kind == 'flare':
        halo = radial(w, h, cx, cy, w * 0.3, h * 0.42, 2.6, 1.0)
        flare = streak(w, h, cy, h * 0.1, [(0, 0), (0.5, 0.35), (1, 0.0)], peak=1.0)
        flare = np.maximum(flare, streak(w, h, cy, h * 0.1, [(0, 0), (0.5, 0.35), (1, 0)], peak=1.0))
        yy, xx = np.mgrid[0:h, 0:w]
        side = np.clip(1 - np.abs(xx - cx) / (w * 0.46), 0, 1) ** 1.6
        halo = np.maximum(halo, side * np.exp(-0.5 * ((yy - cy) / (h * 0.05)) ** 2))
        core = radial(w, h, cx, cy, w * 0.1, h * 0.1, 0.4, 1.0)
        mid = radial(w, h, cx, cy, w * 0.18, h * 0.18, 0.9, 1.0)
    elif kind == 'ring':
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        d = np.sqrt(((xx - cx) / (w * 0.34)) ** 2 + ((yy - cy) / (h * 0.34)) ** 2)
        ring = np.exp(-0.5 * ((d - 0.72) / 0.11) ** 2)
        halo = ring * 0.9
        core = np.exp(-0.5 * ((d - 0.72) / 0.045) ** 2)
        mid = radial(w, h, cx, cy, w * 0.1, h * 0.1, 0.7, 1.0) * 0.8
    else:  # marker
        halo = radial(w, h, cx, cy, w * 0.46, h * 0.3, 2.4, 1.0)
        mid = radial(w, h, cx, cy, w * 0.2, h * 0.14, 1.0, 1.0)
        core = radial(w, h, cx, cy, w * 0.09, h * 0.07, 0.35, 1.0)
    over(img, ramp(blur(halo, w * 0.075), GLOW, CYAN, 1.5))
    over(img, ramp(blur(mid, w * 0.03), CYAN, ICE, 1.0))
    over(img, ramp(blur(core, 1.0), ICE, WHITE, 0.4))
    return save(img, name)


def build_lights():
    for i, kind in enumerate(['dot', 'flare', 'ring', 'marker'], 1):
        light('road-light-0%d.png' % i, 168, 168, kind)


# ---------------------------------------------------------------- clouds
def cloud(name, w, h, puffs):
    m = np.zeros((h, w), np.float32)
    for fx, fy, frx, fry in puffs:
        m = np.maximum(m, radial(w, h, fx * w, fy * h, frx * w, fry * h, falloff=1.5, peak=1.0))
    m = blur(m, max(w, h) * 0.022)
    m = np.clip(m * 1.25, 0, 1)
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    vert = np.clip((y - 0.2) / 0.8, 0, 1)
    edge = np.clip((0.72 - m) / 0.5, 0, 1)
    white = np.array([255, 255, 255], np.float32)
    bottom = np.array([196, 219, 247], np.float32)
    edgec = np.array([132, 182, 238], np.float32)
    base = white * (1 - vert[..., None]) + bottom * vert[..., None]
    k = (0.5 * edge)[..., None]
    col = base * (1 - k) + edgec * k
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[..., 3] = (m * 255).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    # soft top highlight
    hi = np.zeros((h, w), np.float32)
    for fx, fy, frx, fry in puffs[:4]:
        hi = np.maximum(hi, radial(w, h, fx * w, (fy - 0.07) * h, frx * w * 0.72, fry * h * 0.62, 1.6, 0.85))
    hi = blur(hi, max(w, h) * 0.03) * m
    img.alpha_composite(ramp(hi, (255, 255, 255), (255, 255, 255), 1.0))
    return save(img, name)


def build_clouds():
    cloud('cloud-01.png', 640, 320, [
        (0.24, 0.66, 0.20, 0.20), (0.40, 0.56, 0.17, 0.24),
        (0.56, 0.48, 0.20, 0.30), (0.72, 0.58, 0.17, 0.24),
        (0.84, 0.68, 0.15, 0.17), (0.32, 0.74, 0.22, 0.16),
        (0.66, 0.74, 0.24, 0.16), (0.50, 0.70, 0.26, 0.18),
    ])
    cloud('cloud-02.png', 480, 250, [
        (0.26, 0.64, 0.20, 0.22), (0.44, 0.52, 0.19, 0.28),
        (0.62, 0.58, 0.18, 0.24), (0.76, 0.68, 0.15, 0.17),
        (0.40, 0.74, 0.24, 0.16), (0.62, 0.76, 0.22, 0.15),
    ])
    cloud('cloud-03.png', 380, 190, [
        (0.30, 0.62, 0.22, 0.24), (0.52, 0.54, 0.20, 0.28),
        (0.70, 0.66, 0.18, 0.20), (0.50, 0.76, 0.28, 0.16),
    ])


# ---------------------------------------------------------------- logo slot
def logo_slot(w=560, h=260):
    s = 2
    inset, rad = 12, 30

    def draw(d, _s=None):
        d.rounded_rectangle([inset * s, inset * s, (w - inset) * s, (h - inset) * s],
                            radius=rad * s, outline=255, width=3 * s)
    m = ss(draw, w, h, s)

    b = 46
    off = 30
    segs = []
    for sx in (1, -1):
        for sy in (1, -1):
            x0 = off if sx == 1 else w - off
            y0 = off if sy == 1 else h - off
            segs.append(('line', [(x0, y0), (x0 + sx * b, y0)]))
            segs.append(('line', [(x0, y0), (x0, y0 + sy * b)]))
    bm = ss(strokes(segs, 5, 2), w, h, 2)

    img = canvas(w, h)
    over(img, ramp(blur(m, 16) * 0.55, GLOW, CYAN, 1.4))
    over(img, ramp(m, (120, 200, 250), ICE, 0.8))
    over(img, ramp(blur(bm, 10) * 0.8, GLOW, CYAN, 1.3))
    over(img, ramp(bm, ICE, WHITE, 0.5))
    return save(img, 'logo-slot.png')


# ---------------------------------------------------------------- sheet
def build_sheet():
    W, H = 3300, 2100
    sheet = canvas(W, H)
    put = lambda im, x, y: sheet.alpha_composite(im, (x, y))

    # row A : vehicles
    x = 120
    for f, _ in VEHICLES:
        put(vehicle(os.path.join(IMG, f)), x, 150 if 'plane' in f else 168)
        x += Image.open(os.path.join(IMG, f)).width + 120

    # row B : logo slot + clouds
    put(Image.open(os.path.join(PNG, 'logo-slot.png')), 120, 400)
    put(Image.open(os.path.join(PNG, 'cloud-01.png')), 830, 380)
    put(Image.open(os.path.join(PNG, 'cloud-02.png')), 1580, 420)
    put(Image.open(os.path.join(PNG, 'cloud-03.png')), 2180, 445)

    # row C : nav track
    put(Image.open(os.path.join(PNG, 'nav-track.png')), 130, 810)

    # row D : corners + trails
    put(Image.open(os.path.join(PNG, 'track-corner-01.png')), 130, 1270)
    put(Image.open(os.path.join(PNG, 'track-corner-02.png')), 630, 1270)
    put(Image.open(os.path.join(PNG, 'track-corner-03.png')), 1120, 1330)
    put(Image.open(os.path.join(PNG, 'track-corner-04.png')), 1600, 1270)
    put(Image.open(os.path.join(PNG, 'track-line.png')), 2010, 1460)
    put(Image.open(os.path.join(PNG, 'motion-trail-01.png')), 2450, 1270)
    put(Image.open(os.path.join(PNG, 'motion-trail-02.png')), 2450, 1430)
    put(Image.open(os.path.join(PNG, 'motion-trail-03.png')), 2450, 1570)
    put(Image.open(os.path.join(PNG, 'motion-trail-04.png')), 2450, 1720)

    # row E : road lights
    lx = 130
    for i in range(1, 5):
        put(Image.open(os.path.join(PNG, 'road-light-0%d.png' % i)), lx, 1860)
        lx += 210

    sheet.save(SHEET)
    return SHEET


def main():
    build_corners()
    build_trails()
    build_lights()
    build_clouds()
    logo_slot()
    save(nav_track(), 'nav-track.png')
    for f, tag in VEHICLES:
        vehicle(os.path.join(IMG, f)).save(os.path.join(PNG, 'vehicle-%s.png' % tag))
    print('sheet ->', build_sheet())


if __name__ == '__main__':
    main()
