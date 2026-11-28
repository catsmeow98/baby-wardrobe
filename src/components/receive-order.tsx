'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ItemIcon } from '@/components/item-icon';
import { Sheet } from '@/components/sheet';
import { btnCls, btnGhostCls, inputCls } from '@/components/ui';
import { receiveOrder } from '@/app/(app)/shopping/actions';

export interface ReceiveLine { item: string; typeName: string; sizeLabel: string; icon: string; outstanding: number }

/**
 * Receive for one order: a panel with every item still to arrive, its quantity filled in. Take it as it is for the whole
 * order, or lower numbers for what came. Then the page asks whether to add photos now (returnTo gets ?trip=).
 */
export function ReceiveOrder({ orderId, name, lines, returnTo }: { orderId: string; name: string; lines: ReceiveLine[]; returnTo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = (l: ReceiveLine) => qty[l.item] ?? l.outstanding;
  const total = lines.reduce((t, l) => t + q(l), 0);
  const all = lines.reduce((t, l) => t + l.outstanding, 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await receiveOrder(orderId, lines.map((l) => ({ item: l.item, qty: q(l) })));
      if (res.error || !res.trip) setError(res.error ?? 'We could not record that delivery.');
      else {
        setOpen(false);
        const url = new URL(returnTo, window.location.origin);
        url.searchParams.set('trip', res.trip);
        url.searchParams.delete('ok');
        router.push(url.pathname + url.search);
      }
    } catch {
      setError('Could not reach the server. Try again.');
    }
    setSaving(false);
  }

  return (
    <>
      <button type="button" className={btnCls} onClick={() => { setQty({}); setOpen(true); }}>Receive</button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={`Receive ${name}`}>
          <h2 className="font-display text-lg font-bold">What arrived from {name}?</h2>
          <p className="-mt-2 text-sm text-muted">Everything still to come is filled in. Lower a number if only part of it came.</p>
          <ul className="flex max-h-[45vh] flex-col overflow-y-auto">
            {lines.map((l) => (
              <li key={l.item} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
                <ItemIcon itemKey={l.icon} size={22} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1"><b className="block truncate">{l.typeName}</b><span className="text-xs text-muted">{l.sizeLabel} · {l.outstanding} to come</span></span>
                <input className={`${inputCls} w-16`} type="number" min={0} max={l.outstanding} value={q(l)} aria-label={`${l.typeName} received`}
                  onChange={(e) => setQty((x) => ({ ...x, [l.item]: Math.max(0, Math.min(l.outstanding, Math.round(Number(e.target.value) || 0))) }))} />
              </li>
            ))}
          </ul>
          <p className="text-sm">{total === all ? 'The whole order.' : total === 0 ? 'Nothing chosen yet.' : `Part of the order: ${total} of ${all} pieces. The rest stays on order.`}</p>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhostCls} onClick={() => setOpen(false)}>Back</button>
            <button type="button" className={btnCls} disabled={saving || total === 0} onClick={save}>{saving ? 'Saving…' : 'Mark received'}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
