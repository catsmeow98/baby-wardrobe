/**
 * Turns a soft cutout mask (0 to 255 per pixel, row by row) into a clean one: pixels at or above the threshold are in, only
 * the main piece is kept (plus any other piece at least minShare of its size, for items in two parts), and holes inside it are
 * filled. Returns 0 or 255 per pixel.
 */
export function cleanMask(values: ArrayLike<number>, width: number, height: number, threshold = 128, minShare = 0.25): Uint8Array {
  const n = width * height;
  const inside = new Uint8Array(n);
  for (let i = 0; i < n; i++) inside[i] = values[i] >= threshold ? 1 : 0;

  // Label connected pieces (4-way) and measure them.
  const label = new Int32Array(n);
  const sizes: number[] = [0];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!inside[s] || label[s]) continue;
    const id = sizes.length;
    let count = 0;
    let top = 0;
    stack[top++] = s;
    label[s] = id;
    while (top) {
      const p = stack[--top];
      count++;
      const x = p % width;
      if (x > 0 && inside[p - 1] && !label[p - 1]) (label[p - 1] = id), (stack[top++] = p - 1);
      if (x < width - 1 && inside[p + 1] && !label[p + 1]) (label[p + 1] = id), (stack[top++] = p + 1);
      if (p >= width && inside[p - width] && !label[p - width]) (label[p - width] = id), (stack[top++] = p - width);
      if (p < n - width && inside[p + width] && !label[p + width]) (label[p + width] = id), (stack[top++] = p + width);
    }
    sizes.push(count);
  }
  const largest = Math.max(0, ...sizes);
  const keep = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (label[i] && sizes[label[i]] >= largest * minShare) keep[i] = 1;

  // Background is whatever can be reached from the border without crossing the item; everything else is item.
  const outside = new Uint8Array(n);
  let top = 0;
  const seed = (p: number) => {
    if (!keep[p] && !outside[p]) (outside[p] = 1), (stack[top++] = p);
  };
  for (let x = 0; x < width; x++) (seed(x), seed(n - width + x));
  for (let y = 0; y < height; y++) (seed(y * width), seed(y * width + width - 1));
  while (top) {
    const p = stack[--top];
    const x = p % width;
    if (x > 0) seed(p - 1);
    if (x < width - 1) seed(p + 1);
    if (p >= width) seed(p - width);
    if (p < n - width) seed(p + width);
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = outside[i] ? 0 : 255;
  return out;
}

export interface RefineOptions {
  /** Saliency at or below this is background. Lower than the old fixed 128, so thin parts such as sleeves survive. */
  low?: number;
  /** Saliency at or above this is fully item, even on the edge. Between the two, edge pixels fade. */
  full?: number;
  /** Other pieces at least this share of the largest piece are kept, so a second item in the photo stays. */
  minShare?: number;
}

/**
 * Turns a soft saliency map (0 to 255) into the alpha channel for a cutout. The shape comes from cleanMask (main piece or
 * pieces, holes filled). Inside it every pixel is solid, except a two-pixel band along the outer edge, which fades with the
 * saliency so the edge is soft instead of a hard jagged line. Returns 0 to 255 per pixel.
 */
export function refineMask(values: ArrayLike<number>, width: number, height: number, opts: RefineOptions = {}): Uint8Array {
  const { low = 90, full = 130, minShare = 0.12 } = opts;
  const n = width * height;
  const shape = cleanMask(values, width, height, low, minShare);
  // Edge band: pixels within two steps of the background.
  const near = (p: number, flags: Uint8Array): boolean => {
    const x = p % width;
    return (x > 0 && flags[p - 1] === 1) || (x < width - 1 && flags[p + 1] === 1) || (p >= width && flags[p - width] === 1) || (p < n - width && flags[p + width] === 1);
  };
  const bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) bg[i] = shape[i] ? 0 : 1;
  const edge1 = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (shape[i] && near(i, bg)) edge1[i] = 1;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!shape[i]) continue;
    const onEdge = edge1[i] === 1 || near(i, edge1);
    // A filled hole (saliency under low) is item. A weak edge pixel fades.
    out[i] = onEdge && values[i] >= low ? Math.round(255 * Math.min(1, Math.max(0, (values[i] - low) / (full - low)))) : 255;
  }
  return out;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The rectangle around everything visible in an alpha channel, with a margin. Null when nothing is visible. */
export function alphaBounds(alpha: ArrayLike<number>, width: number, height: number, minAlpha = 16, marginFraction = 0.04): Box | null {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] >= minAlpha) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const m = Math.round(Math.max(width, height) * marginFraction);
  const x = Math.max(0, x0 - m);
  const y = Math.max(0, y0 - m);
  return { x, y, width: Math.min(width, x1 + m + 1) - x, height: Math.min(height, y1 + m + 1) - y };
}

/** Cropping only pays when the item leaves real room around it. */
export const worthCropping = (box: Box, width: number, height: number, maxFraction = 0.92): boolean => box.width < width * maxFraction || box.height < height * maxFraction;

export const scaleBox = (b: Box, sx: number, sy: number): Box => ({ x: Math.round(b.x * sx), y: Math.round(b.y * sy), width: Math.max(1, Math.round(b.width * sx)), height: Math.max(1, Math.round(b.height * sy)) });
