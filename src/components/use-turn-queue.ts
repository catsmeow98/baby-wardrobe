'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Quick photo turns. Each tap turns the picture on screen at once (shown, in quarter turns, for a CSS rotation), and the
 * real save waits until the taps stop, so two quick taps save one half turn and a turn back and forth saves nothing.
 * save(quarterTurns) gets 1, 2 or 3 (clockwise) and should show the saved picture before it resolves; taps made while it
 * runs are saved after it.
 */
export function useTurnQueue(save: (quarterTurns: number) => Promise<void>, delay = 700) {
  const [shown, setShown] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => () => clearTimeout(timer.current), []);

  async function flush() {
    if (busy.current) {
      timer.current = setTimeout(flush, delay);
      return;
    }
    const n = pending.current;
    const q = ((n % 4) + 4) % 4;
    if (q === 0) {
      pending.current -= n;
      setShown(pending.current);
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await saveRef.current(q);
    } catch {
      setError('The photo could not be turned. Check your connection and try again.');
    }
    // Saved or not, those taps are done: on success the new picture already shows them, on failure the photo is as it was.
    pending.current -= n;
    setShown(pending.current);
    busy.current = false;
    setSaving(false);
  }

  function turn(dir: 1 | -1) {
    setError(null);
    pending.current += dir;
    setShown(pending.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }

  /** The CSS for the picture: rotated by the taps not saved yet. */
  const style = shown ? { transform: `rotate(${shown * 90}deg)`, transition: 'transform 150ms ease-out' } : undefined;
  return { turn, shown, saving, error, style };
}
