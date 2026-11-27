import { refineMask } from '@/lib/mask-clean';
import { hasNativeSegmenter, nativeMaskSquare } from '@/lib/native-cutout';

/**
 * The one place that knows how backgrounds are removed. Runs in the browser, loaded only when a photo is picked with the
 * setting on. Engine: BiRefNet lite (MIT, by Peng Zheng et al.), a browser-ready ONNX export from CoderViking/birefnet-lite-onnx
 * on Hugging Face (about 200 MB, downloaded once and cached by the browser), run by onnxruntime-web (MIT). It won the Cutout
 * lab test against IS-Net: it kept sleeves and a second garment that IS-Net dropped. Nothing is sent to a server.
 *
 * Inside the Android app the native ML Kit cutout (src/lib/native-cutout.ts) is used instead; see removeBackgroundFrom.
 *
 * Model facts (the same as the lab's): input float32[1,3,1024,1024], RGB scaled to 0..1 then ImageNet-normalised
 * ((value - mean) / std); the first output is a 1 x 1 x 1024 x 1024 map of logits, squashed with a sigmoid.
 * Check before shipping that the model licence still reads MIT.
 * To use a different engine, change this file only. Failures here are caught by the caller, which keeps the original photo.
 */
const MODEL_URL = 'https://huggingface.co/CoderViking/birefnet-lite-onnx/resolve/main/birefnet-lite-1024.onnx';
export const MODEL_MB = 200;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const ORT_VERSION = '1.21.0'; // keep in step with package.json
const SIDE = 1024;

interface Tensor {
  data: Float32Array;
}
interface Session {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, Tensor>>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create: (model: Uint8Array, options: { executionProviders: string[] }) => Promise<Session> };
}

/** Progress text for the person, for example while the model downloads the first time. */
export type OnStatus = (text: string) => void;

let loading: Promise<{ ort: Ort; session: Session }> | null = null;
let ready = false;

async function download(onStatus?: OnStatus): Promise<Uint8Array> {
  const res = await fetch(MODEL_URL, { cache: 'force-cache' });
  if (!res.ok || !res.body) throw new Error(`model download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || MODEL_MB * 1e6;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let done = 0;
  let shown = -1;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    parts.push(value);
    done += value.length;
    const pct = Math.min(99, Math.floor((100 * done) / total));
    // A cached model arrives in a moment; only show progress that is worth reading.
    if (pct !== shown && pct % 5 === 0) {
      shown = pct;
      onStatus?.(`Getting the cutout tool (${pct}% of ${MODEL_MB} MB, first time only)…`);
    }
  }
  const all = new Uint8Array(done);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

function load(onStatus?: OnStatus) {
  loading ??= (async () => {
    const ort = (await import('onnxruntime-web/wasm')) as unknown as Ort;
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    ort.env.wasm.numThreads = 1; // the site is not cross-origin isolated, so one thread
    const bytes = await download(onStatus);
    onStatus?.('Starting the cutout tool…');
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    ready = true;
    return { ort, session };
  })().catch((e) => {
    loading = null; // allow a retry after a failed download
    throw e;
  });
  return loading;
}

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  return { c, ctx };
};

/** The cutout keeps the photo's full frame (transparent where the background was), so it always lines up with the original. */
export async function removeBackgroundFrom(image: Blob, onStatus?: OnStatus): Promise<Blob> {
  const bmp = await createImageBitmap(image);
  const small = canvasOf(SIDE, SIDE);
  // Inside the Android app, Android's own cutout (ML Kit): nothing to download, and it won the Cutout lab test.
  // In a browser, BiRefNet lite below. Both end in the same cleanup, so cutouts look alike either way.
  if (hasNativeSegmenter()) {
    onStatus?.('Removing the background…');
    const { soft } = await nativeMaskSquare(bmp, SIDE);
    return finish(bmp, small, soft, 0, 1);
  }
  const { ort, session } = await load(ready ? undefined : onStatus);
  onStatus?.('Removing the background…');

  // Input: the photo squashed to 1024 x 1024, as planar RGB.
  small.ctx.drawImage(bmp, 0, 0, SIDE, SIDE);
  const rgba = small.ctx.getImageData(0, 0, SIDE, SIDE).data;
  const plane = SIDE * SIDE;
  const input = new Float32Array(3 * plane);
  for (let c = 0; c < 3; c++) for (let i = 0; i < plane; i++) input[c * plane + i] = (rgba[i * 4 + c] / 255 - MEAN[c]) / STD[c];
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIDE, SIDE]) });
  const sal = out[session.outputNames[0]].data;
  if (sal.length !== plane) throw new Error(`unexpected model output size (${sal.length})`);

  // Logits to 0..255 with a sigmoid (the lab's BiRefNet setting), then scale it up to the photo.
  let lo = Infinity;
  let hi = -Infinity;
  const soft = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) {
    if (sal[i] < lo) lo = sal[i];
    if (sal[i] > hi) hi = sal[i];
    soft[i] = Math.round(255 / (1 + Math.exp(-sal[i])));
  }
  return finish(bmp, small, soft, lo, hi);
}

/** From a soft mask (SIDE x SIDE, 0..255) to the cutout: cleanup, scaled to the photo, checked, and applied as transparency. */
async function finish(bmp: ImageBitmap, small: ReturnType<typeof canvasOf>, soft: Uint8Array, lo: number, hi: number): Promise<Blob> {
  const w = bmp.width;
  const h = bmp.height;
  const plane = SIDE * SIDE;
  // Shape: keep the main piece (and a second item), drop specks, fill holes; edge: a soft two-pixel fade.
  const clean = refineMask(soft, SIDE, SIDE);
  const m = small.ctx.createImageData(SIDE, SIDE);
  for (let i = 0; i < plane; i++) {
    m.data[i * 4] = clean[i];
    m.data[i * 4 + 1] = clean[i];
    m.data[i * 4 + 2] = clean[i];
    m.data[i * 4 + 3] = 255;
  }
  small.ctx.putImageData(m, 0, 0);
  const big = canvasOf(w, h);
  big.ctx.imageSmoothingQuality = 'high';
  big.ctx.drawImage(small.c, 0, 0, w, h);
  const mask = big.ctx.getImageData(0, 0, w, h).data;

  // Refuse a mask that keeps almost nothing or almost everything: report it instead of saving a blank or unchanged photo.
  let kept = 0;
  let n = 0;
  for (let i = 0; i < w * h; i += 7) {
    if (mask[i * 4] > 127) kept++;
    n++;
  }
  const pct = Math.round((kept / n) * 100);
  console.debug('Background removal mask', { keptPercent: pct, saliencyLow: lo, saliencyHigh: hi, width: w, height: h });
  if (pct < 2 || pct > 98) throw new Error(`the mask keeps ${pct}% of the photo (model values ${lo.toFixed(3)} to ${hi.toFixed(3)})`);

  // Original pixels with the mask as the alpha channel.
  const result = canvasOf(w, h);
  result.ctx.drawImage(bmp, 0, 0, w, h);
  const px = result.ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) px.data[i * 4 + 3] = mask[i * 4];
  result.ctx.putImageData(px, 0, 0);
  return new Promise((resolve, reject) => result.c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'));
}
