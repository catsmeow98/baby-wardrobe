'use client';

import { useEffect, useState } from 'react';
import { btnCls, btnGhostCls } from '@/components/ui';
import { LAB_MODELS, runLabModel, type LabModel, type LabResult } from '@/lib/cutout-lab';

const CHECKER = 'repeating-conic-gradient(#e4e4e7 0% 25%, #fafafa 0% 50%) 0 0 / 16px 16px';

interface Card {
  status: string;
  busy: boolean;
  result: LabResult | null;
  error: string | null;
}
const EMPTY: Card = { status: '', busy: false, result: null, error: null };

/** Pick a photo, then run each model on it, one at a time, and compare. Only for testing. */
export function CutoutLab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, Card>>({});
  const anyBusy = Object.values(cards).some((c) => c.busy);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const patch = (id: string, p: Partial<Card>) => setCards((all) => ({ ...all, [id]: { ...EMPTY, ...all[id], ...p } }));

  async function run(model: LabModel) {
    if (!file) return;
    const old = cards[model.id]?.result;
    if (old) {
      URL.revokeObjectURL(old.cleanUrl);
      URL.revokeObjectURL(old.rawUrl);
    }
    patch(model.id, { busy: true, error: null, result: null, status: 'Starting…' });
    try {
      const result = await runLabModel(model, file, (status) => patch(model.id, { status }));
      patch(model.id, { busy: false, result, status: '' });
    } catch (e) {
      patch(model.id, { busy: false, error: e instanceof Error ? e.message : String(e), status: '' });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Photo to test
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {preview && <img src={preview} alt="The photo being tested" className="max-h-64 rounded-lg border border-line object-contain" />}

      {LAB_MODELS.map((m) => {
        const c = cards[m.id] ?? EMPTY;
        return (
          <section key={m.id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
            <div>
              <h2 className="font-display text-lg font-bold">{m.label}</h2>
              <p className="text-sm text-muted">{m.note} About {m.sizeMB} MB, {m.licence}.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={c.result ? btnGhostCls : btnCls} disabled={!file || anyBusy} onClick={() => run(m)}>
                {c.result ? 'Run again' : `Run (downloads ${m.sizeMB} MB the first time)`}
              </button>
              {c.busy && <span className="text-sm text-muted" role="status">{c.status}</span>}
            </div>
            {c.error && <p role="alert" className="text-sm text-bad">It failed: {c.error}</p>}
            {c.result && (
              <>
                <p className="text-sm text-muted">
                  Download {c.result.downloadSeconds.toFixed(1)} s · start {c.result.loadSeconds.toFixed(1)} s · cut out {c.result.runSeconds.toFixed(1)} s · keeps {c.result.keptPercent}% of the photo
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[['What the app would save', c.result.cleanUrl], ['Raw model output', c.result.rawUrl]].map(([label, url]) => (
                    <figure key={label} className="flex flex-col gap-1">
                      <div className="overflow-hidden rounded-lg border border-line" style={{ background: CHECKER }}>
                        <img src={url} alt={`${m.label}: ${label}`} className="block w-full" />
                      </div>
                      <figcaption className="text-xs text-muted">{label}</figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
