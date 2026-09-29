"""Key the dark backdrop out of the vehicle PNGs (light-background safe).

Pipeline per image:
  1. seed   = bright / saturated pixels (paint + glowing trail streaks)
  2. close  = morphological close   -> bridges dark windows, wheels, intakes
  3. blob   = largest connected component of `close`, then fill holes
  4. prune  = drop filled regions outside the dense vehicle columns
              (that is where the old smoke backdrop gets enclosed)
  5. keep   = pruned hull | bright trail streaks
  6. output = original RGB with alpha = alpha * blur(keep)
"""
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import os
import sys

SRC = [
    ('img/plane-nav.png', 'assets/vehicles/plane-nav.png', 15),
    ('img/train-nav.png', 'assets/vehicles/train-nav.png', 21),
    ('img/autobus-nav.png', 'assets/vehicles/autobus-nav.png', 21),
]


def to_img(mask: np.ndarray) -> Image.Image:
    m = (mask * 255).astype(np.uint8)
    return Image.frombytes('L', (m.shape[1], m.shape[0]), m.tobytes())


def fill_holes(mask: np.ndarray) -> np.ndarray:
    """Fill regions that are not connected to the image border."""
    pad = np.zeros((mask.shape[0] + 2, mask.shape[1] + 2), bool)
    pad[1:-1, 1:-1] = mask
    bg = (~pad * 255).astype(np.uint8)
    img = Image.frombytes('L', (bg.shape[1], bg.shape[0]), bg.tobytes())
    w, h = img.size
    for x in range(w):
        for y in (0, h - 1):
            if img.getpixel((x, y)) == 255:
                ImageDraw.floodfill(img, (x, y), 128)
    for y in range(h):
        for x in (0, w - 1):
            if img.getpixel((x, y)) == 255:
                ImageDraw.floodfill(img, (x, y), 128)
    return mask | (np.asarray(img)[1:-1, 1:-1] == 255)


def largest_component(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    best = best_size = cur = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if labels[y0, x0]:
            continue
        cur += 1
        stack = [(y0, x0)]
        labels[y0, x0] = cur
        size = 0
        while stack:
            y, x = stack.pop()
            size += 1
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = cur
                    stack.append((ny, nx))
        if size > best_size:
            best_size, best = size, cur
    return labels == best


def clean(src, dst, close_k=21, col_t=0.60, near_r=11, alpha_floor=0.75):
    im = Image.open(src).convert('RGBA')
    arr = np.asarray(im).astype(np.float32) / 255
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)

    seed = (lum > 0.55) | ((sat > 0.5) & (lum > 0.30))

    # vehicle body only: walk in from the right until the paint mass thins out
    col = seed.sum(axis=0)
    thr = 0.38 * col.max()
    left, gap = seed.shape[1] - 1, 0
    while left > 0:
        if col[left] >= thr:
            gap = 0
        else:
            gap += 1
            if gap > 14:
                break
        left -= 1

    crop = np.zeros_like(seed)
    crop[:, left:] = seed[:, left:]
    closed = to_img(crop).filter(ImageFilter.MaxFilter(close_k)).filter(ImageFilter.MinFilter(close_k))
    hull = fill_holes(largest_component(np.asarray(closed) > 127))
    hull = fill_holes(np.asarray(to_img(hull).filter(ImageFilter.MaxFilter(5))
                                 .filter(ImageFilter.MinFilter(5))) > 127)
    keep = hull

    soft = np.asarray(to_img(keep).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255
    na = np.clip(a * soft, 0, 1)
    out = np.dstack([(arr[..., :3] * 255).astype(np.uint8), (na * 255).astype(np.uint8)])
    if os.path.dirname(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
    Image.fromarray(out, 'RGBA').save(dst)
    print(f'{os.path.basename(src)} -> {dst}  hull {hull.mean()*100:.1f}%  kept {(na > 0.02).mean()*100:.1f}%')


def preview(cols=(0.40, 0.60, 0.80), scale=1.0):
    tiles = []
    for src, _dst, k in SRC:
        im = Image.open(src).convert('RGBA')
        rows = [im]
        for c in cols:
            tmp = '/tmp/_prev.png'
            clean(src, tmp, k, c)
            rows.append(Image.open(tmp).convert('RGBA'))
        w = int(im.width * scale)
        h = int(im.height * scale)
        canvas = Image.new('RGBA', (w, h * len(rows) + 8 * len(rows)), (206, 226, 248, 255))
        y = 0
        for row in rows:
            canvas.alpha_composite(row.resize((w, h)), (0, y))
            y += h + 8
        tiles.append(canvas.convert('RGB'))
    W = max(t.width for t in tiles)
    H = sum(t.height for t in tiles) + 30 * len(tiles)
    out = Image.new('RGB', (W, H), (245, 247, 251))
    y = 0
    for t in tiles:
        out.paste(t, (0, y))
        y += t.height + 30
    out.save('/tmp/veh-preview.png')
    print('preview /tmp/veh-preview.png', out.size)


if __name__ == '__main__':
    if '--preview' in sys.argv:
        scale = float(sys.argv[sys.argv.index('--preview') + 1]) if len(sys.argv) > sys.argv.index('--preview') + 1 else 1.0
        preview(scale=scale)
    else:
        inplace = '--inplace' in sys.argv
        for src, dst, k in SRC:
            clean(src, src if inplace else dst, k)
