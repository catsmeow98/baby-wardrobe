/**
 * Helpers for the paths of a photo and its stored original. A form carries a photo as one field: the photo's path, or
 * "path|originalPath" when the original was kept. Pure functions, so the server and the browser share them.
 */
export interface PhotoRef {
  path: string;
  originalPath?: string;
}

export const joinPhotoField = (path: string, originalPath?: string): string => (originalPath ? `${path}|${originalPath}` : path);

export function splitPhotoField(value: string): PhotoRef {
  const [path, originalPath] = value.split('|');
  return originalPath ? { path, originalPath } : { path };
}

/** A path the server will accept: inside the person's folder for this child, a jpg or png, short, and no way out of the folder. */
export function validPhotoPath(path: string, prefix: string): boolean {
  return path.startsWith(prefix) && !path.includes('..') && !path.includes('|') && path.length <= 200 && /\.(jpg|png)$/.test(path);
}

/** Every storage path a photo reference uses (the picture, and its original when there is one; the same file once). */
export const pathsOf = (ref: PhotoRef): string[] => [...new Set(ref.originalPath ? [ref.path, ref.originalPath] : [ref.path])];
