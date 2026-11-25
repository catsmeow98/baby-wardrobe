/**
 * The one place that knows how backgrounds are removed. Runs in the browser, loaded only when a photo is picked with the
 * setting on. Engine: BiRefNet (lite, 512 pixels) from the studioludens Hugging Face repo (MIT licence, a copy of ZhengPeng7/BiRefNet_lite), run by Transformers.js
 * (Apache-2.0). Nothing is sent to a server: the model downloads once and the browser caches it.
 *
 * Check before shipping: that the model files you serve still carry the MIT licence, and how the cutouts look on real photos.
 * To use a different engine, change this file only. Failures here are caught by the caller, which keeps the original photo.
 */
// A 512 x 512 conversion of BiRefNet_lite (MIT, by studioludens). The 1024 version runs out of memory on the plain browser engine.
const MODEL = 'studioludens/birefnet-lite-512';
const SIDE = 512; // the model's working size

type Engine = {
  model: (inputs: Record<string, unknown>) => Promise<Record<string, { sigmoid: () => { mul: (n: number) => { to: (t: string) => unknown } } }>>;
  processor: (img: unknown) => Promise<{ pixel_values: unknown }>;
  RawImage: {
    fromBlob: (b: Blob) => Promise<{ width: number; height: number; data: Uint8ClampedArray; channels: number }>;
    fromTensor: (t: unknown) => { resize: (w: number, h: number) => Promise<{ data: Uint8ClampedArray }> };
  };
  inputName: string;
};

let loading: Promise<Engine> | null = null;

async function build(device: 'webgpu' | 'wasm'): Promise<Engine> {
  const tf = await import('@huggingface/transformers');
  // fp16 weights (94 MB) need WebGPU; the plain browser engine uses the fp32 file (183 MB). Both download once, then are cached.
  const model = await tf.AutoModel.from_pretrained(MODEL, { device, dtype: device === 'webgpu' ? 'fp16' : 'fp32' });
  const processor = await tf.AutoProcessor.from_pretrained(MODEL, {});
  const m = model as unknown as { sessions?: { model?: { inputNames?: string[] } }; session?: { inputNames?: string[] } };
  const names = m.sessions?.model?.inputNames ?? m.session?.inputNames ?? [];
  return { model, processor, RawImage: tf.RawImage, inputName: names[0] ?? 'input_image' } as unknown as Engine;
}

function load(): Promise<Engine> {
  loading ??= (async () => {
    const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    if (!gpu) return build('wasm');
    try {
      return await build('webgpu');
    } catch (e) {
      console.warn('WebGPU engine failed, trying the plain browser engine', e);
      return build('wasm');
    }
  })().catch((e) => {
    loading = null; // allow a retry after a failed download
    throw e;
  });
  return loading;
}

export async function removeBackgroundFrom(image: Blob): Promise<Blob> {
  const { model, processor, RawImage, inputName } = await load();
  const img = await RawImage.fromBlob(image);
  const { pixel_values } = await processor(img);
  const out = await model({ [inputName]: pixel_values });
  // Pick the model's final output by name (the conversion calls it "logits"; other copies call it "output_image").
  const keys = Object.keys(out);
  const key = ['logits', 'output_image', 'output'].find((k) => k in out) ?? keys[keys.length - 1];
  const logits = out[key] as unknown as Record<number, typeof out[string]> & { dims?: number[] };
  console.debug('Background removal output', key, keys, logits.dims);
  const mask = await RawImage.fromTensor(logits[0].sigmoid().mul(255).to('uint8') as never).resize(img.width, img.height);

  const ch = Math.max(1, Math.round(mask.data.length / (img.width * img.height))); // channels per pixel in the mask

  // Measure how much of the photo the mask keeps. Almost nothing, or almost everything, means the model output was misread:
  // report it (with numbers) instead of saving a blank or unchanged photo.
  let lo = 255;
  let hi = 0;
  let kept = 0;
  let n = 0;
  for (let i = 0; i < img.width * img.height; i += 7) {
    const v = mask.data[i * ch];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    if (v > 127) kept++;
    n++;
  }
  const pct = Math.round((kept / n) * 100);
  console.debug('Background removal mask', { lo, hi, keptPercent: pct, width: img.width, height: img.height, channels: ch });
  if (pct < 2 || pct > 98) throw new Error(`the mask keeps ${pct}% of the photo (range ${lo} to ${hi}, output ${key}, shape ${logits.dims?.join('x')}, ${ch} channel)`);

  // Original pixels with the mask as the alpha channel.
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const bmp = await createImageBitmap(image);
  ctx.drawImage(bmp, 0, 0, img.width, img.height);
  const px = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < img.width * img.height; i++) px.data[i * 4 + 3] = mask.data[i * ch];
  ctx.putImageData(px, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'));
}

export const CUTOUT_MODEL_SIDE = SIDE;
