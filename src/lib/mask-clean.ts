/**
 * Turns a soft cutout mask (0 to 255 per pixel, row by row) into a clean one: pixels at or above the threshold are in, only
 * the main piece is kept (plus any other piece at least a quarter its size, for items in two parts), and holes inside it are
 * filled. Returns 0 or 255 per pixel.
 */
export function cleanMask(values: ArrayLike<number>, width: number, height: number, threshold = 128): Uint8Array {
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
  for (let i = 0; i < n; i++) if (label[i] && sizes[label[i]] * 4 >= largest) keep[i] = 1;

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
