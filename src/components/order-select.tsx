'use client';

import { createContext, useContext, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import { btnCls, btnGhostCls, inputCls } from '@/components/ui';
import { placeOrder } from '@/app/(app)/shopping/actions';

/** One thing that can go in an order: a shopping list entry, or a goal gap (a new entry is made for it). */
export type OrderLineRef = { item: string } | { categoryId: string; sizeId: string };
interface Picked { line: OrderLineRef; qty: number; label: string }
interface Ctx { picked: Record<string, Picked>; set: (key: string, p: Picked | null) => void }
const OrderCtx = createContext<Ctx | null>(null);

/** "Nov 27, 7:42 PM": the name an order gets when none is typed. */
export const defaultOrderName = () => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());

/**
 * Ticking things on the Shopping page to order together. Wrap the page in it; OrderCheck goes on each orderable row, and
 * OrderBar shows "Mark N ordered" at the bottom, which asks for the order's name (the date and time if left as is).
 */
export function OrderSelect({ children }: { children: React.ReactNode }) {
  const [picked, setPicked] = useState<Record<string, Picked>>({});
  const set = (key: string, p: Picked | null) => setPicked((all) => {
    const next = { ...all };
    if (p) next[key] = p;
    else delete next[key];
    return next;
  });
  return (
    <OrderCtx.Provider value={{ picked, set }}>
      {children}
      <OrderBar />
    </OrderCtx.Provider>
  );
}

/** A tick box and quantity for one row. */
export function OrderCheck({ id, line, defaultQty, label }: { id: string; line: OrderLineRef; defaultQty: number; label: string }) {
  const ctx = useContext(OrderCtx);
  const on = Boolean(ctx?.picked[id]);
  const qty = ctx?.picked[id]?.qty ?? defaultQty;
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="size-5 accent-accent" checked={on} onChange={(e) => ctx?.set(id, e.target.checked ? { line, qty, label } : null)} />
        Order
      </label>
      <input className={`${inputCls} w-16`} type="number" min={1} max={999} value={qty} aria-label={`Quantity of ${label} to order`}
        onChange={(e) => { const n = Math.max(1, Math.min(999, Math.round(Number(e.target.value) || 1))); ctx?.set(id, { line, qty: n, label }); }} />
    </div>
  );
}

function OrderBar() {
  const ctx = useContext(OrderCtx);
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!ctx) return null;
  const list = Object.values(ctx.picked);
  if (!list.length && !asking) return null;
  const pieces = list.reduce((t, p) => t + p.qty, 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await placeOrder(name.trim() || defaultOrderName(), list.map((p) => ({ ...p.line, qty: p.qty })));
      if (!res.ok) setError(res.error ?? 'We could not place that order.');
      else {
        Object.keys(ctx!.picked).forEach((k) => ctx!.set(k, null));
        setAsking(false);
        setName('');
        router.refresh();
      }
    } catch {
      setError('Could not reach the server. Try again.');
    }
    setSaving(false);
  }

  return (
    <>
      {list.length > 0 && !asking && (
        <div className="sticky bottom-[var(--nav-h,0px)] z-20 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur">
          <span className="text-sm"><b>{list.length}</b> item{list.length === 1 ? '' : 's'} · {pieces} piece{pieces === 1 ? '' : 's'}</span>
          <span className="flex gap-2">
            <button type="button" className={btnGhostCls} onClick={() => Object.keys(ctx.picked).forEach((k) => ctx.set(k, null))}>Clear</button>
            <button type="button" className={btnCls} onClick={() => setAsking(true)}>Mark ordered</button>
          </span>
        </div>
      )}
      {asking && (
        <Sheet onClose={() => setAsking(false)} label="Name this order">
          <h2 className="font-display text-lg font-bold">Mark {pieces} piece{pieces === 1 ? '' : 's'} ordered</h2>
          <ul className="text-sm text-muted">{list.map((p, i) => <li key={i}>{p.qty} × {p.label}</li>)}</ul>
          <label className="flex flex-col gap-1 text-sm font-medium">Order name
            <input className={inputCls} value={name} maxLength={80} placeholder={defaultOrderName()} onChange={(e) => setName(e.target.value)} />
            <span className="text-xs font-normal text-muted">Leave it empty to use the date and time.</span>
          </label>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnGhostCls} onClick={() => setAsking(false)}>Back</button>
            <button type="button" className={btnCls} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Mark ordered'}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
