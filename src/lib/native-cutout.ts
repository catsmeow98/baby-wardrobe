/**
 * Background removal through the Android app's native SubjectSegmenter plugin (Google ML Kit subject segmentation, see
 * mobile/native). Only there inside the app; in a browser hasNativeSegmenter() is false and the web model is used instead.
 */
interface NativeBridge {
  isNativePlatform?: () => boolean;
  registerPlugin?: (name: string) => Record<string, (opts: unknown) => Promise<unknown>>;
  Plugins?: Record<string, Record<string, (opts: unknown) => Promise<unknown>> | undefined>;
}
const bridge = (): NativeBridge | undefined => (globalThis as { Capacitor?: NativeBridge }).Capacitor;

/** True inside the Android app, where the native ML Kit plugin is there to call. */
export const hasNativeSegmenter = () => Boolean(bridge()?.isNativePlatform?.());

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  return { c, ctx };
};

/**
 * The photo through ML Kit, as a soft mask (0..255) squashed to side x side, the shape the cleanup (refineMask) and the rest
 * of the cutout code work in. The photo is sent at most side pixels on its long side, keeping its shape. ms: ML Kit's own time.
 */
export async function nativeMaskSquare(bmp: ImageBitmap, side: number): Promise<{ soft: Uint8Array; ms: number }> {
  const cap = bridge();
  const plugin = cap?.Plugins?.SubjectSegmenter ?? cap?.registerPlugin?.('SubjectSegmenter');
  if (!plugin?.segment) throw new Error('The native cutout is only in the Android app (update the app if it is missing).');
  const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const photo = canvasOf(Math.max(1, Math.round(bmp.width * scale)), Math.max(1, Math.round(bmp.height * scale)));
  photo.ctx.drawImage(bmp, 0, 0, photo.c.width, photo.c.height);
  const jpeg = photo.c.toDataURL('image/jpeg', 0.92).split(',')[1];
  const res = (await plugin.segment({ image: jpeg })) as { mask: string; width: number; height: number; ms: number };
  const bin = atob(res.mask);
  if (bin.length !== res.width * res.height) throw new Error(`unexpected mask size (${bin.length})`);

  const m = canvasOf(res.width, res.height);
  const md = m.ctx.createImageData(res.width, res.height);
  for (let i = 0; i < bin.length; i++) {
    const v = bin.charCodeAt(i);
    md.data[i * 4] = v;
    md.data[i * 4 + 1] = v;
    md.data[i * 4 + 2] = v;
    md.data[i * 4 + 3] = 255;
  }
  m.ctx.putImageData(md, 0, 0);
  const sq = canvasOf(side, side);
  sq.ctx.imageSmoothingQuality = 'high';
  sq.ctx.drawImage(m.c, 0, 0, side, side);
  const px = sq.ctx.getImageData(0, 0, side, side).data;
  const soft = new Uint8Array(side * side);
  for (let i = 0; i < soft.length; i++) soft[i] = px[i * 4];
  return { soft, ms: res.ms };
}
