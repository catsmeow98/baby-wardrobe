'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A full-screen camera for snapping clothes one after another: a live view, a shutter, and Done. Each photo is handed over
 * straight away (onShot) so it can be processed and uploaded while the next one is taken. Uses the back camera when there is
 * one. If the live camera cannot start (no permission, an older phone), it offers the phone's own camera instead.
 * status: short progress text from the page ("Processing 2 of 3…"), shown under the shutter.
 */
export function CameraCapture({ onShot, onClose, multiple = true, status }: {
  onShot: (file: File) => void;
  onClose: () => void;
  multiple?: boolean;
  status?: string | null;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const fallback = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no live camera.');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        setError(name === 'NotAllowedError' ? 'The camera is blocked. Allow camera access for this app, or use the phone camera below.' : 'The live camera could not start. Use the phone camera below.');
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => () => { if (last) URL.revokeObjectURL(last); }, [last]);

  function snap() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    setFlash(true);
    setTimeout(() => setFlash(false), 120);
    c.toBlob((b) => {
      if (!b) return;
      const file = new File([b], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setLast(URL.createObjectURL(b));
      setCount((n) => n + 1);
      onShot(file);
      if (!multiple) onClose();
    }, 'image/jpeg', 0.9);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Camera" className="fixed inset-0 z-[70] flex flex-col bg-black pt-[var(--safe-top)] text-white">
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <span>{count ? `${count} photo${count === 1 ? '' : 's'} taken` : multiple ? 'Snap each item, then tap Done' : 'Snap the item'}</span>
        <button type="button" className="underline" onClick={onClose}>{count ? 'Done' : 'Cancel'}</button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="size-full object-contain" />
        {flash && <div className="absolute inset-0 bg-white/70" />}
        {!ready && !error && <p className="absolute inset-0 flex items-center justify-center text-sm opacity-80">Starting the camera…</p>}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p>{error}</p>
            <input ref={fallback} type="file" accept="image/*" capture="environment" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setCount((n) => n + 1); onShot(f); if (!multiple) onClose(); } }} />
            <button type="button" className="rounded-full bg-white px-5 py-2.5 font-medium text-black" onClick={() => fallback.current?.click()}>Use the phone camera</button>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-[calc(1rem+var(--safe-bottom))]">
        <div className="size-14 overflow-hidden rounded-lg bg-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {last && <img src={last} alt="Last photo" className="size-full object-cover" />}
        </div>
        <button type="button" onClick={snap} disabled={!ready} aria-label="Take photo"
          className="size-[4.5rem] rounded-full border-4 border-white bg-white/20 active:bg-white/60 disabled:opacity-40" />
        <button type="button" onClick={onClose} className="w-14 text-sm font-medium">{count ? 'Done' : 'Cancel'}</button>
      </div>
      {status && <p className="pb-[calc(0.5rem+var(--safe-bottom))] text-center text-xs opacity-80" role="status">{status}</p>}
    </div>
  );
}
