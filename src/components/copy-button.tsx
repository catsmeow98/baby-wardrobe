'use client';

import { useState } from 'react';
import { btnGhostCls } from '@/components/ui';

/** Copies text to the clipboard and says so. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  return (
    <button
      type="button"
      className={btnGhostCls}
      disabled={!text}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState('done');
        } catch {
          setState('failed');
        }
        setTimeout(() => setState('idle'), 2500);
      }}
    >
      {state === 'done' ? 'Copied' : state === 'failed' ? 'Could not copy' : label}
    </button>
  );
}
