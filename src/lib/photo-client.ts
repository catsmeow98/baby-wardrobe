import { scaleBox } from '@/lib/mask-clean';
const MAX_SIDE = 1600;
/** Background removal runs on a smaller copy: it is much faster, and a closet photo does not need more. */
export const CUTOUT_SIDE = 1024;

const encode = async (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> => {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
  if (!blob) throw new Error('encode');
  return blob;
};

/** Shrinks a phone photo to at most maxSide px on the long side and re-encodes it as JPEG. Browser only. */
export async function shrinkImage(file: Blob, maxSide = MAX_SIDE): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return encode(canvas, 'image/jpeg', 0.85);
}

/** The file extension to store a processed photo under. A cutout is a PNG because it needs transparency. */
export const extOf = (blob: Blob): 'png' | 'jpg' => (blob.type === 'image/png' ? 'png' : 'jpg');

export interface ProcessedPhoto {
  /** What to upload: the cutout when background removal worked, otherwise the shrunk photo. */
  blob: Blob;
  /** The shrunk photo with its background, kept so the person can go back to it. */
  original: Blob;
  cutout: boolean;
  /** Background removal was wanted but did not work (offline, model blocked, low memory), so the original is used. */
  failed: boolean;
  /** Why the background step failed, for the message shown to the person. */
  reason?: string;
}

/** Shrinks a photo and, when asked, removes its background. Never throws for a removal problem: it falls back to the original. */
/** A readable cause. The browser's AI engine throws a bare number when it runs out of memory. */
export const reasonOf = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e);
  return /^\d+$/.test(m.trim()) ? `the browser ran out of memory (code ${m.trim()})` : m;
};

/** onStatus gets short progress text (the first cutout downloads the model), for showing on the busy button. */
export async function processPhoto(file: File, removeBackground: boolean, onStatus?: (text: string) => void): Promise<ProcessedPhoto> {
  const original = await shrinkImage(file);
  if (!removeBackground) return { blob: original, original, cutout: false, failed: false };
  try {
    const small = await shrinkImage(original, CUTOUT_SIDE);
    const { removeBackgroundFrom } = await import('@/lib/bg-remove');
    return { blob: await removeBackgroundFrom(small, onStatus), original, cutout: true, failed: false };
  } catch (e) {
    console.error('Background removal failed', e);
    return { blob: original, original, cutout: false, failed: true, reason: reasonOf(e) };
  }
}

/** Turns an image a number of quarter turns clockwise, keeping its type (so a cutout keeps its transparency). */
export async function rotateBlob(blob: Blob, quarterTurns: number): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const turns = ((quarterTurns % 4) + 4) % 4;
  const swap = turns % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bmp.height : bmp.width;
  canvas.height = swap ? bmp.width : bmp.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
  bmp.close();
  return encode(canvas, blob.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
}

/**
 * One quarter turn (dir 1 clockwise, -1 counterclockwise) for a photo and its original, so Restore keeps lining up. An original that is the photo itself
 * (sameFile) stays the same file. No original gives none back.
 */
export async function turnWithOriginal(blob: Blob, original?: Blob, sameFile = false, dir: 1 | -1 = 1): Promise<{ result: Blob; original?: Blob }> {
  const result = await rotateBlob(blob, dir);
  if (sameFile) return { result, original: result };
  return { result, original: original ? await rotateBlob(original, dir) : undefined };
}

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Cuts a rectangle (in the image's own pixels) out of an image, keeping its type. */
export async function cropBlob(blob: Blob, area: CropArea): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  canvas.getContext('2d')!.drawImage(bmp, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return encode(canvas, blob.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
}

/**
 * The original, turned and cropped the same way as the edited picture, so Restore keeps lining up after the picture is saved.
 * area is in the edited picture's own pixels, and is scaled to the original's size (they can differ: the original is larger).
 */
export async function alignOriginal(original: Blob, turns: number, area: CropArea | null, edited: { width: number; height: number }): Promise<Blob> {
  const turned = ((turns % 4) + 4) % 4 === 0 ? original : await rotateBlob(original, turns);
  if (!area) return turned;
  const bmp = await createImageBitmap(turned);
  const scaled = scaleBox(area, bmp.width / edited.width, bmp.height / edited.height);
  bmp.close();
  return cropBlob(turned, scaled);
}
