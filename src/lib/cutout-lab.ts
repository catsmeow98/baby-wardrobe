import { refineMask } from '@/lib/mask-clean';

/**
 * A test bench for background removal models. It is not used by the app's photo flow: the Cutout lab page runs one model at
 * a time on a photo you pick so the results can be compared on a phone. A model that wins gets wired into bg-remove.ts.
 * Everything runs in the browser; nothing is uploaded. Models download once and the browser keeps them.
 */
export interface LabModel {
  id: string;
  label: string;
  note: string;
  sizeMB: number;
  url: string;
  licence: string;
  /** Pixel is scaled to 0..1, then (value - mean) / std per colour channel. */
  mean: [number, number, number];
  std: [number, number, number];
  /** True when the output is raw logits (squash with a sigmoid). Otherwise the output is stretched to its own min..max. */
  sigmoid: boolean;
}

export const LAB_MODELS: LabModel[] = [
  {
    id: 'isnet-q8',
    label: 'IS-Net, small (what the app used before)',
    note: '8-bit version of IS-Net general use.',
    sizeMB: 44,
    url: 'https://huggingface.co/SacredNoir/isnet-general-use-onnx/resolve/main/isnet-general-use-q8.onnx',
    licence: 'Apache-2.0',
    mean: [128 / 255, 128 / 255, 128 / 255],
    std: [256 / 255, 256 / 255, 256 / 255],
    sigmoid: false,
  },
  {
    id: 'isnet-fp32',
    label: 'IS-Net, full precision',
    note: 'The same model without the 8-bit squeeze, so edges should be cleaner.',
    sizeMB: 176,
    url: 'https://huggingface.co/SacredNoir/isnet-general-use-onnx/resolve/main/isnet-general-use.onnx',
    licence: 'Apache-2.0',
    mean: [128 / 255, 128 / 255, 128 / 255],
    std: [256 / 255, 256 / 255, 256 / 255],
    sigmoid: false,
  },
  {
    id: 'birefnet-lite',
    label: 'BiRefNet lite (what the app uses now)',
    note: 'A newer, more detailed model. A browser-ready export (CoderViking/birefnet-lite-onnx).',
    sizeMB: 200,
    url: 'https://huggingface.co/CoderViking/birefnet-lite-onnx/resolve/main/birefnet-lite-1024.onnx',
    licence: 'MIT',
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
    sigmoid: true,
  },
];

export interface LabResult {
  /** Object URLs for PNGs. The page revokes them when a new result replaces these. */
  cleanUrl: string;
  rawUrl: string;
  downloadSeconds: number;
  loadSeconds: number;
  runSeconds: number;
  keptPercent: number;
}

interface Tensor {
  data: Float32Array;
}
interface Session {
  inputNames: string[];
  outputNames: string[];
  run: (feeds: Record<string, unknown>) => Promise<Record<string, Tensor>>;
  release?: () => Promise<void>;
}
interface Ort {
  env: { wasm: { wasmPaths: string; numThreads: number } };
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => unknown;
  InferenceSession: { create: (model: Uint8Array, options: { executionProviders: string[] }) => Promise<Session> };
}

const ORT_VERSION = '1.21.0'; // the same as the app (package.json)
const SIDE = 1024;
const SHOW_MAX = 900; // longest side of the pictures shown on the page

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no canvas');
  return { c, ctx };
};

async function download(url: string, onProgress: (done: number, total: number) => void): Promise<Uint8Array> {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let done = 0;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    parts.push(value);
    done += value.length;
    onProgress(done, total);
  }
  const all = new Uint8Array(done);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

const png = (c: HTMLCanvasElement) => new Promise<string>((resolve, reject) => c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('encode failed'))), 'image/png'));

export async function runLabModel(model: LabModel, image: Blob, onStatus: (text: string) => void): Promise<LabResult> {
  const t0 = performance.now();
  const bytes = await download(model.url, (done, total) =>
    onStatus(total ? `Downloading ${model.label}: ${Math.round((100 * done) / total)}% of ${Math.round(total / 1e6)} MB` : `Downloading ${model.label}: ${Math.round(done / 1e6)} MB`));
  const t1 = performance.now();

  onStatus('Starting the model…');
  const ort = (await import('onnxruntime-web/wasm')) as unknown as Ort;
  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
  const t2 = performance.now();

  try {
    onStatus('Cutting out…');
    const bmp = await createImageBitmap(image);
    const scale = Math.min(1, SHOW_MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const small = canvasOf(SIDE, SIDE);
    small.ctx.drawImage(bmp, 0, 0, SIDE, SIDE);
    const rgba = small.ctx.getImageData(0, 0, SIDE, SIDE).data;
    const plane = SIDE * SIDE;
    const input = new Float32Array(3 * plane);
    for (let c = 0; c < 3; c++) for (let i = 0; i < plane; i++) input[c * plane + i] = (rgba[i * 4 + c] / 255 - model.mean[c]) / model.std[c];
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIDE, SIDE]) });
    const sal = out[session.outputNames[0]].data;
    if (sal.length !== plane) throw new Error(`unexpected model output size (${sal.length})`);
    const t3 = performance.now();

    const soft = new Uint8Array(plane);
    if (model.sigmoid) {
      for (let i = 0; i < plane; i++) soft[i] = Math.round(255 / (1 + Math.exp(-sal[i])));
    } else {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < plane; i++) {
        if (sal[i] < lo) lo = sal[i];
        if (sal[i] > hi) hi = sal[i];
      }
      if (!(hi - lo > 1e-6)) throw new Error('the model gave a flat result');
      for (let i = 0; i < plane; i++) soft[i] = Math.round((255 * (sal[i] - lo)) / (hi - lo));
    }
    const clean = refineMask(soft, SIDE, SIDE);

    const cutout = async (alpha: ArrayLike<number>) => {
      const m = small.ctx.createImageData(SIDE, SIDE);
      for (let i = 0; i < plane; i++) {
        m.data[i * 4] = alpha[i];
        m.data[i * 4 + 1] = alpha[i];
        m.data[i * 4 + 2] = alpha[i];
        m.data[i * 4 + 3] = 255;
      }
      small.ctx.putImageData(m, 0, 0);
      const big = canvasOf(w, h);
      big.ctx.imageSmoothingQuality = 'high';
      big.ctx.drawImage(small.c, 0, 0, w, h);
      const mask = big.ctx.getImageData(0, 0, w, h).data;
      const res = canvasOf(w, h);
      res.ctx.drawImage(bmp, 0, 0, w, h);
      const px = res.ctx.getImageData(0, 0, w, h);
      for (let i = 0; i < w * h; i++) px.data[i * 4 + 3] = mask[i * 4];
      res.ctx.putImageData(px, 0, 0);
      return png(res.c);
    };
    const cleanUrl = await cutout(clean);
    const rawUrl = await cutout(soft);
    let kept = 0;
    for (let i = 0; i < plane; i += 7) if (clean[i] > 127) kept++;
    return {
      cleanUrl,
      rawUrl,
      downloadSeconds: (t1 - t0) / 1000,
      loadSeconds: (t2 - t1) / 1000,
      runSeconds: (t3 - t2) / 1000,
      keptPercent: Math.round((100 * kept) / Math.ceil(plane / 7)),
    };
  } finally {
    await session.release?.().catch(() => undefined);
  }
}
