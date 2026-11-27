'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { PhotoEditButton } from '@/components/photo-edit-button';

/**
 * One photo on an item's page, with its Turn / Edit / Remove background buttons. A change shows here straight away (from the
 * picture just saved) while the page reloads in the background, instead of waiting for the reload.
 */
export function ItemPhoto({ photoId, url, path, originalPath, alt, userId, childId, children }: {
  photoId: string;
  url: string;
  path: string;
  originalPath?: string;
  alt: string;
  userId: string;
  childId: string;
  /** Extra controls beside the buttons (the delete form). */
  children?: React.ReactNode;
}) {
  const [local, setLocal] = useState<{ src: string; cutout: boolean } | null>(null);
  const [turnStyle, setTurnStyle] = useState<CSSProperties | undefined>();
  useEffect(() => () => { if (local) URL.revokeObjectURL(local.src); }, [local]);
  const src = local?.src ?? url;
  const cutout = local ? local.cutout : path.toLowerCase().endsWith('.png');
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={turnStyle} className={`aspect-square w-full rounded-lg ${cutout ? 'bg-line object-contain' : 'object-cover'}`} />
      <div className="flex flex-wrap items-center gap-3">
        <PhotoEditButton photoId={photoId} url={url} path={path} originalPath={originalPath} userId={userId} childId={childId}
          onSaved={(b) => setLocal({ src: URL.createObjectURL(b), cutout: b.type === 'image/png' })} onTurnStyle={setTurnStyle} />
        {children}
      </div>
    </>
  );
}
