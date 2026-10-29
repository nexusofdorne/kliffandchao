"""Depth estimate and sky mask for the journey and wedding paintings (used by build_world.py).

The paintings are single pictures, so depth is a rule of thumb that suits them:
  * sky: smooth, bright, not green, connected to the top edge;
  * the rest: nearer when it is lower in the frame, finer in detail (far hills are
    soft and hazy, grass and leaves are sharp) and closer to the left/right edges
    (the tall plants that frame both pictures).
"""
import numpy as np
from scipy import ndimage as ndi


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def detail_energy(a):
    """How much fine texture is around each pixel (0..1, scene-relative)."""
    L = a.mean(2)
    band = np.abs(ndi.gaussian_filter(L, 1.0) - ndi.gaussian_filter(L, 3.0))
    d = ndi.gaussian_filter(band, 5)
    return np.clip(d / np.percentile(d, 96), 0, 1)


def sky_mask(a, detail):
    L = a.mean(2)
    H, W = L.shape
    smooth = detail < 0.16
    bluish = a[..., 2] >= a[..., 0] - 0.03
    bright = L > 0.42
    cand = smooth & bluish & bright
    cand = ndi.binary_opening(cand, iterations=2)
    lab, n = ndi.label(cand)
    top = np.unique(lab[0:6, :])
    top = top[top > 0]
    sky = np.isin(lab, top)
    sky = ndi.binary_closing(sky, iterations=6)
    sky = ndi.binary_fill_holes(sky)
    return sky


def depth_map(a, horizon_y, edge_boost=0.3):
    """0 = far (sky), 1 = right at the lens.

    Ground and water get nearer the lower they are (a flat plane seen from low down),
    hills are far, and anything that stands in front of the sky (the tall plants that
    frame both pictures) is near, more so toward the left and right edges.
    """
    H, W = a.shape[:2]
    detail = detail_energy(a)
    sky = sky_mask(a, detail)
    y = np.arange(H)[:, None] * np.ones((1, W))
    x = np.arange(W)[None, :] * np.ones((H, 1))

    # the ground plane
    yg = np.clip((y - horizon_y) / (H - horizon_y), 0, 1)
    ground = 0.2 + 0.6 * yg ** 0.85
    # hills and distant land above the horizon are one far layer
    # no hard step at the horizon: the far hills hand over to the ground over ~120 px
    blend = smoothstep(horizon_y - 30, horizon_y + 90, y)
    d = 0.12 + (ground - 0.12) * blend

    # plants in front of the sky: non-sky pixels that have sky below them in their column
    rows = np.arange(H)[:, None]
    has_sky = sky.any(0)
    sky_bottom = (sky * rows).max(0).astype(np.float32)  # lowest sky row per column
    if has_sky.any() and not has_sky.all():
        # columns with no sky at all (a plant fills them) take the nearest column that has some
        idx = ndi.distance_transform_edt(~has_sky, return_distances=False, return_indices=True)
        sky_bottom = sky_bottom[idx[0]]
    sky_bottom = ndi.uniform_filter1d(sky_bottom, 9)
    plant_core = (~sky) & (rows < sky_bottom[None, :] - 4) & (rows > 8)
    plant_core = ndi.binary_opening(plant_core, iterations=1)
    plant = ndi.binary_dilation(plant_core, iterations=22) & ((detail > 0.3) | plant_core)
    edge = smoothstep(0.2, 1.0, np.abs(x - W / 2) / (W / 2))
    plant_d = 0.5 + 0.2 * edge + 0.25 * np.clip(detail, 0, 1)
    d = np.where(plant, np.maximum(d, plant_d), d)
    # sharp plant detail toward the left and right edges is close to the lens even
    # when it stands among the grass (the tall stems and shrubs framing both pictures)
    framing = smoothstep(0.25, 0.75, detail) * edge
    d = np.maximum(d, np.where((framing > 0.12) & ~sky, 0.3 + 0.5 * framing, 0))

    d = np.clip(d, 0, 1)
    d[sky] = 0
    d = np.where(sky, 0, ndi.gaussian_filter(d, 2.0))
    return d, sky, detail, plant_core


def lift_building(d, sky, box, arch):
    """The building at the end of the path stands in the middle distance, in front of the hills:
    everything in its box that is neither sky nor nearer already is lifted to just inside the mid
    layer. The round opening through it stays with the hills."""
    H, W = d.shape
    x0, y0, x1, y1 = box
    yy, xx = np.mgrid[0:H, 0:W]
    (cx, cy), r = arch
    in_box = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    opening = (xx - cx) ** 2 + (yy - cy) ** 2 < r ** 2
    lift = ndi.gaussian_filter((in_box & ~opening & ~sky).astype(np.float32), 3)
    out = np.maximum(d, 0.24 * lift)
    out[sky] = 0
    return out


def room_depth(a, window, floor_y):
    """Depth for a room seen through to a round window (the wedding hall).

    The view through the window is the far distance (its bright, smooth top is sky); the walls,
    balconies and plants get nearer the further they are from the window, and the floor gets
    nearer the lower it is.
    """
    H, W = a.shape[:2]
    (cx, cy), r = window
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    inside = dist < r - 2
    detail = detail_energy(a)
    L = a.mean(2)
    sky = inside & (yy < cy + 0.45 * r) & (detail < 0.2) & (L > 0.6) & (a[..., 2] >= a[..., 0] - 0.04)
    sky = ndi.binary_opening(sky, iterations=2)
    lab, _ = ndi.label(sky)
    top = np.unique(lab[int(cy - r * 0.8): int(cy - r * 0.6), int(cx - 20): int(cx + 20)])
    sky = ndi.binary_fill_holes(np.isin(lab, top[top > 0]))

    walls = 0.26 + 0.42 * smoothstep(r, r + 900, dist)
    floor = 0.42 + 0.5 * np.clip((yy - floor_y) / (H - floor_y), 0, 1) ** 0.8
    d = np.where(yy > floor_y, np.maximum(walls, floor), walls)
    # the plants and chrome pieces at the sides stand in front of the wall behind them
    d = np.maximum(d, np.where(~inside, 0.2 + 0.55 * smoothstep(0.3, 0.9, detail) * smoothstep(r, r + 500, dist), 0))
    soft_inside = ndi.gaussian_filter(inside.astype(np.float32), 2.0)
    d = d * (1 - soft_inside) + 0.1 * soft_inside
    d = ndi.gaussian_filter(d, 2.0)
    d[sky] = 0
    return np.clip(d, 0, 1), sky


def sky_fill_rows(a, valid):
    """The sky behind things that stand in front of it: each row continues from the sky
    on either side of the gap (the sky is a gradient from blue overhead to haze at the
    horizon, so rows follow it), and rows with no sky at all repeat the last one."""
    H, W, _ = a.shape
    out = np.zeros_like(a)
    xs = np.arange(W)
    last = None
    for y in range(H):
        v = valid[y]
        if v.sum() >= 24:
            row = np.stack([np.interp(xs, xs[v], a[y, v, c]) for c in range(3)], axis=1)
            last = row
        else:
            row = last if last is not None else np.full((W, 3), 0.8, np.float32)
        out[y] = row
    return ndi.gaussian_filter(out, (22, 40, 0))


def push_pull_fill(img, valid, levels=9):
    """Fill the pixels where `valid` is false from the ones where it is true, smoothly
    (normalised averaging down a pyramid and back up). img: HxWxC float."""
    H, W, C = img.shape
    w = valid.astype(np.float32)
    num = img * w[..., None]
    pyr = []
    n, d = num, w
    for _ in range(levels):
        pyr.append((n, d))
        h2, w2 = (n.shape[0] + 1) // 2, (n.shape[1] + 1) // 2
        pn = np.pad(n, ((0, h2 * 2 - n.shape[0]), (0, w2 * 2 - n.shape[1]), (0, 0)))
        pd = np.pad(d, ((0, h2 * 2 - d.shape[0]), (0, w2 * 2 - d.shape[1])))
        n = pn.reshape(h2, 2, w2, 2, C).sum((1, 3))
        d = pd.reshape(h2, 2, w2, 2).sum((1, 3))
    # coarsest level average, then walk up, filling only where there is no data
    fill = n / np.maximum(d[..., None], 1e-6)
    # cells of the coarsest level with no data at all take the nearest cell that has some
    empty = d <= 0
    if empty.any() and not empty.all():
        idx = ndi.distance_transform_edt(empty, return_distances=False, return_indices=True)
        fill = fill[idx[0], idx[1]]
    for (pn_, pd_) in reversed(pyr):
        up = ndi.zoom(fill, (pn_.shape[0] / fill.shape[0], pn_.shape[1] / fill.shape[1], 1), order=1, mode="nearest")
        up = up[: pn_.shape[0], : pn_.shape[1]]
        own = pn_ / np.maximum(pd_[..., None], 1e-6)
        conf = np.clip(pd_[..., None] / 2.0, 0, 1)
        fill = own * conf + up * (1 - conf)
    return fill
