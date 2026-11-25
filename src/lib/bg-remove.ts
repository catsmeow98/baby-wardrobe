/**
 * The one place that knows how backgrounds are removed. Runs in the browser, loaded only when a photo is picked with the
 * setting on. Engine: BiRefNet (lite) from the onnx-community Hugging Face repo (MIT licence), run by Transformers.js
 * (Apache-2.0). Nothing is sent to a server: the model downloads once and the browser caches it.
 *
 * Check before shipping: that the model files you serve still carry the MIT licence, and how the cutouts look on real photos.
 * To use a different engine, change this file only. Failures here are caught by the caller, which keeps the original photo.
 */
const MODEL = 'onnx-community/BiRefNet_lite-ONNX';
const SIDE = 1024; // the model's working size; the photo is shrunk to this before it gets here

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

function load(): Promise<Engine> {
  loading ??= (async () => {
    const tf = await import('@huggingface/transformers');
    const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    // fp16 weights need WebGPU; the plain browser engine uses the 8-bit file, which is smaller and a little rougher.
    const model = await tf.AutoModel.from_pretrained(MODEL, { device: gpu ? 'webgpu' : 'wasm', dtype: gpu ? 'fp16' : 'q8' });
    const processor = await tf.AutoProcessor.from_pretrained(MODEL, {});
    const names: string[] = (model as unknown as { sessions?: { model?: { inputNames?: string[] } } }).sessions?.model?.inputNames ?? [];
    return { model, processor, RawImage: tf.RawImage, inputName: names[0] ?? 'input_image' } as unknown as Engine;
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
  const logits = Object.values(out)[0];
  const mask = await RawImage.fromTensor(logits.sigmoid().mul(255).to('uint8') as never).resize(img.width, img.height);

  // Original pixels with the mask as the alpha channel.
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  const bmp = await createImageBitmap(image);
  ctx.drawImage(bmp, 0, 0, img.width, img.height);
  const px = ctx.getImageData(0, 0, img.width, img.height);
  for (let i = 0; i < img.width * img.height; i++) px.data[i * 4 + 3] = mask.data[i];
  ctx.putImageData(px, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'));
}

export const CUTOUT_MODEL_SIDE = SIDE;
