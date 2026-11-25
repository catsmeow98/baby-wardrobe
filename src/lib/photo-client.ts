const MAX_SIDE = 1600;
/** Background removal runs on a smaller copy: it is much faster, and a closet photo does not need more. */
const CUTOUT_SIDE = 1024;

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
}

/** Shrinks a photo and, when asked, removes its background. Never throws for a removal problem: it falls back to the original. */
export async function processPhoto(file: File, removeBackground: boolean): Promise<ProcessedPhoto> {
  const original = await shrinkImage(file);
  if (!removeBackground) return { blob: original, original, cutout: false, failed: false };
  try {
    const small = await shrinkImage(original, CUTOUT_SIDE);
    const { removeBackgroundFrom } = await import('@/lib/bg-remove');
    return { blob: await removeBackgroundFrom(small), original, cutout: true, failed: false };
  } catch {
    return { blob: original, original, cutout: false, failed: true };
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
