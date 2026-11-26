import { alphaBounds, refineMask, worthCropping, type Box } from '@/lib/mask-clean';

/**
 * The one place that knows how backgrounds are removed. Runs in the browser, loaded only when a photo is picked with the
 * setting on. Engine: IS-Net "general use" (Apache-2.0, from the DIS project by Xuebin Qin et al.), the 8-bit version from the
 * SacredNoir mirror on Hugging Face (about 44 MB, downloaded once and cached by the browser), run by onnxruntime-web (MIT).
 * Nothing is sent to a server.
 *
 * Model facts, from the mirror's page: input "float32[1,3,1024,1024]", RGB, each value (pixel - 128) / 256; the first output
 * is a 1 x 1 x 1024 x 1024 saliency map. Check before shipping that the model licence still reads Apache-2.0.
 * To use a different engine, change this file only. Failures here are caught by the caller, which keeps the original photo.
 */
const MODEL_URL = 'https://huggingface.co/SacredNoir/isnet-general-use-onnx/resolve/main/isnet-general-use-q8.onnx';
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

let loading: Promise<{ ort: Ort; session: Session }> | null = null;

function load() {
  loading ??= (async () => {
    const ort = (await import('onnxruntime-web/wasm')) as unknown as Ort;
    ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
    ort.env.wasm.numThreads = 1; // the site is not cross-origin isolated, so one thread
    const res = await fetch(MODEL_URL, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`model download failed (${res.status})`);
    const session = await ort.InferenceSession.create(new Uint8Array(await res.arrayBuffer()), { executionProviders: ['wasm'] });
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

/** The cutout, and the rectangle (in the input photo's pixels) it was cropped to, or null when it was not cropped. */
export interface Cutout {
  blob: Blob;
  box: Box | null;
}

export async function removeBackgroundFrom(image: Blob): Promise<Cutout> {
  const { ort, session } = await load();
  const bmp = await createImageBitmap(image);
  const w = bmp.width;
  const h = bmp.height;

  // Input: the photo squashed to 1024 x 1024, as planar RGB.
  const small = canvasOf(SIDE, SIDE);
  small.ctx.drawImage(bmp, 0, 0, SIDE, SIDE);
  const rgba = small.ctx.getImageData(0, 0, SIDE, SIDE).data;
  const plane = SIDE * SIDE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = (rgba[i * 4] - 128) / 256;
    input[plane + i] = (rgba[i * 4 + 1] - 128) / 256;
    input[2 * plane + i] = (rgba[i * 4 + 2] - 128) / 256;
  }
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIDE, SIDE]) });
  const sal = out[session.outputNames[0]].data;
  if (sal.length !== plane) throw new Error(`unexpected model output size (${sal.length})`);

  // Stretch the saliency map to 0..255 (as the model's own tooling does), then scale it up to the photo.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < plane; i++) {
    if (sal[i] < lo) lo = sal[i];
    if (sal[i] > hi) hi = sal[i];
  }
  if (!(hi - lo > 1e-6)) throw new Error(`the model gave a flat result (${lo} to ${hi})`);
  const soft = new Uint8Array(plane);
  for (let i = 0; i < plane; i++) soft[i] = Math.round((255 * (sal[i] - lo)) / (hi - lo));
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
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    alpha[i] = mask[i * 4];
    px.data[i * 4 + 3] = alpha[i];
  }
  result.ctx.putImageData(px, 0, 0);

  // Crop tight to the item (with a margin) when it leaves real room around it.
  const found = alphaBounds(alpha, w, h);
  const box = found && worthCropping(found, w, h) ? found : null;
  let source = result.c;
  if (box) {
    const cropped = canvasOf(box.width, box.height);
    cropped.ctx.drawImage(result.c, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    source = cropped.c;
  }
  const blob = await new Promise<Blob>((resolve, reject) => source.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'));
  return { blob, box };
}
