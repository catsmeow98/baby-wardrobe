/**
 * Guesses an item's main color from its photo, as one of the app's colors (COLOR_VALUES), or null when it cannot tell.
 * A cutout (transparent background) is read from the item's own pixels only. A photo with a background is read from its middle,
 * leaving out pixels close to the colour around its edges (the floor or bed it was laid on).
 * Each pixel is named by colorOfPixel; the most common name wins when it covers enough of the item, otherwise it is multicolor.
 */
import type { COLOR_VALUES } from '@/lib/validation/items';

export type ColorValue = (typeof COLOR_VALUES)[number];

/** Hue (0 to 360), saturation and lightness (0 to 1). */
function hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

/**
 * Names one pixel as one of the app's colors (never multicolor). Grayness goes by chroma (the spread between the strongest and
 * weakest channel), not HSL saturation, which reads dim colours (a blue in shade) as gray. Photos are usually darker than
 * the clothes, so a pale neutral counts as white well below pure white.
 */
export function colorOfPixel(r: number, g: number, b: number): Exclude<ColorValue, 'multicolor'> {
  const [h, , l] = hsl(r, g, b);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (l < 0.12) return 'black';
  // Warm, pale and only a little colour: cream (ivory, beige, oatmeal).
  if (l > 0.68 && chroma >= 10 && chroma < 70 && h >= 25 && h <= 65) return 'cream';
  if (chroma < 16 || (l > 0.85 && chroma < 24)) return l > 0.62 ? 'white' : l < 0.2 ? 'black' : 'gray';
  if (l < 0.18 && chroma < 30) return 'black';
  if (h < 15 || h >= 335) {
    if (l > 0.68) return 'pink';
    return l < 0.28 && chroma < 90 ? 'brown' : 'red';
  }
  if (h < 45) {
    if (l < 0.42 || chroma < 70) return l > 0.68 ? 'cream' : 'brown';
    return l > 0.75 ? 'pink' : 'orange';
  }
  if (h < 68) return l < 0.3 ? 'brown' : chroma < 45 && l > 0.6 ? 'cream' : 'yellow';
  if (h < 170) return 'green';
  if (h < 255) return l < 0.28 || (h > 215 && l < 0.34) ? 'navy' : 'blue';
  if (h < 290) return 'purple';
  return l < 0.35 ? 'purple' : 'pink';
}

const NEUTRAL = new Set(['gray', 'white', 'black']);

/**
 * Picks the main color from named pixels. Exported for tests. Shadows and folds turn part of any item gray, so gray only wins
 * when it is most of the item and no real colour covers a good share of it.
 */
export function pickColor(counts: ReadonlyMap<string, number>, minPixels = 50): ColorValue | null {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total < minPixels || total === 0) return null;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const topColour = sorted.find(([k]) => !NEUTRAL.has(k));
  if (sorted[0][0] === 'gray' && topColour && topColour[1] / total >= 0.2) {
    const rest = sorted.filter(([k]) => k !== 'gray');
    return pickColor(new Map(rest), 1);
  }
  const [top, n] = sorted[0];
  if (top === 'gray' && n / total < 0.55) {
    const white = counts.get('white') ?? 0;
    if (white / total >= 0.25) return 'white';
  }
  if (n / total >= 0.45) return top as ColorValue;
  // Neighbouring names of one colour (navy and blue, pink and red, cream and white) count together.
  const kin: Record<string, string[]> = { navy: ['blue'], blue: ['navy'], pink: ['red', 'purple'], red: ['pink', 'orange'], cream: ['white', 'yellow'], white: ['cream', 'gray'], gray: ['white', 'black'], brown: ['orange'], orange: ['brown', 'red'] };
  const near = n + (kin[top] ?? []).reduce((a, k) => a + (counts.get(k) ?? 0), 0);
  if (near / total >= 0.6) return top as ColorValue;
  return 'multicolor';
}

const SIDE = 96;

/** Reads a photo and guesses its main color. Never throws: a photo it cannot read gives null. */
export async function detectColor(blob: Blob): Promise<ColorValue | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const px = ctx.getImageData(0, 0, w, h).data;

    let clear = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 128) clear++;
    const cutout = clear > (w * h) / 20;

    // Without a cutout: the average colour around the edge stands for the background.
    let bg: [number, number, number] | null = null;
    if (!cutout) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (x > 1 && x < w - 2 && y > 1 && y < h - 2) continue;
        const i = (y * w + x) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      bg = [r / n, g / n, b / n];
    }

    const counts = new Map<string, number>();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (cutout) {
        if (px[i + 3] < 200) continue;
        // The cutout's edge picks up the old background and shadow, so only pixels inside the item count.
        const solid = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && px[(yy * w + xx) * 4 + 3] >= 200;
        if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) continue;
      } else {
        if (x < w * 0.2 || x > w * 0.8 || y < h * 0.2 || y > h * 0.8) continue;
        const d = Math.abs(px[i] - bg![0]) + Math.abs(px[i + 1] - bg![1]) + Math.abs(px[i + 2] - bg![2]);
        if (d < 60) continue;
      }
      const name = colorOfPixel(px[i], px[i + 1], px[i + 2]);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return pickColor(counts);
  } catch (e) {
    console.error('Color detection failed', e);
    return null;
  }
}
