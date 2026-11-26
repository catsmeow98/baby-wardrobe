'use client';

import { useEffect, useRef, useState } from 'react';
import { btnCls, btnGhostCls } from '@/components/ui';

const MAX_UNDO = 8;
const CHECKER = 'repeating-conic-gradient(#e4e4e7 0% 25%, #fafafa 0% 50%) 0 0 / 20px 20px';

/**
 * Brush touch-up for a cutout. Erase rubs parts away; Restore paints the original photo back in. Restore needs the original
 * (a photo saved earlier has none, so it only erases). The original is drawn stretched to the cutout's size, which lines up
 * because both were cropped to the same area. onDone gets the edited PNG.
 */
export function PhotoTouchUp({ blob, original, onDone, onCancel }: {
  blob: Blob;
  original?: Blob;
  onDone: (result: Blob) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const origRef = useRef<ImageBitmap | null>(null);
  const undo = useRef<ImageData[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<'erase' | 'restore'>('erase');
  const [size, setSize] = useState(28);
  const [ready, setReady] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const bmp = await createImageBitmap(blob);
        const canvas = canvasRef.current;
        if (!canvas || dead) return;
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        canvas.getContext('2d')!.drawImage(bmp, 0, 0);
        bmp.close();
        origRef.current = original ? await createImageBitmap(original) : null;
        if (!dead) setReady(true);
      } catch {
        if (!dead) setError('That photo could not be opened for touch-up.');
      }
    })();
    return () => {
      dead = true;
      origRef.current?.close();
    };
  }, [blob, original]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  /** Brush radius in image pixels: the slider is a share of the picture's shorter side. */
  const radius = () => {
    const c = canvasRef.current!;
    return (Math.min(c.width, c.height) * size) / 1000;
  };

  const stamp = (x: number, y: number) => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius(), 0, Math.PI * 2);
    if (mode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
    } else if (origRef.current) {
      ctx.clip();
      ctx.drawImage(origRef.current, 0, 0, c.width, c.height);
    }
    ctx.restore();
  };

  const stroke = (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
    const step = Math.max(1, radius() / 3);
    const dx = from ? to.x - from.x : 0;
    const dy = from ? to.y - from.y : 0;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
    for (let i = 1; i <= n; i++) stamp(from ? from.x + (dx * i) / n : to.x, from ? from.y + (dy * i) / n : to.y);
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const c = canvasRef.current!;
    undo.current.push(c.getContext('2d')!.getImageData(0, 0, c.width, c.height));
    if (undo.current.length > MAX_UNDO) undo.current.shift();
    setUndoCount(undo.current.length);
    const p = point(e);
    last.current = p;
    stroke(null, p);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const p = point(e);
    stroke(last.current, p);
    last.current = p;
  };
  const up = () => {
    last.current = null;
  };

  const undoLast = () => {
    const snap = undo.current.pop();
    if (snap) canvasRef.current!.getContext('2d')!.putImageData(snap, 0, 0);
    setUndoCount(undo.current.length);
  };

  const done = () => {
    canvasRef.current!.toBlob((b) => (b ? onDone(b) : setError('We could not save that change. Try again.')), 'image/png');
  };

  const canRestore = original !== undefined;
  const pill = (active: boolean, disabled = false) =>
    `rounded-full border px-3 py-1 text-sm disabled:opacity-40 ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'} ${disabled ? '' : ''}`;

  return (
    <div role="dialog" aria-modal="true" aria-label="Touch up photo" className="fixed inset-0 z-[60] flex flex-col bg-black/80 p-3">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl" style={{ background: CHECKER }}>
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full touch-none"
          style={{ cursor: 'crosshair' }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
      </div>
      <div className="mt-3 flex flex-col gap-3 rounded-xl bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Brush">
          <button type="button" aria-pressed={mode === 'erase'} className={pill(mode === 'erase')} onClick={() => setMode('erase')}>Erase</button>
          <button type="button" aria-pressed={mode === 'restore'} disabled={!canRestore} className={pill(mode === 'restore')} onClick={() => setMode('restore')}>Restore</button>
          <button type="button" className={btnGhostCls} disabled={undoCount === 0} onClick={undoLast}>Undo</button>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Brush
            <input type="range" min={8} max={80} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Brush size" />
          </label>
        </div>
        {!canRestore && <p className="text-sm text-muted">This photo has no stored original (it was added before originals were kept, or without background removal), so it can only be erased.</p>}
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className={btnCls} disabled={!ready} onClick={done}>Done</button>
          <button type="button" className={btnGhostCls} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
