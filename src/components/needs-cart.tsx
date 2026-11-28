'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ItemIcon } from '@/components/item-icon';
import { Sheet } from '@/components/sheet';
import { defaultOrderName } from '@/components/order-select';
import { btnCls, btnGhostCls, inputCls } from '@/components/ui';
import { MAX_IN_CART, cartKey, cartLines, cartPieces, cartStorageKey, leftToFind, parseCart, setInCart, splitKey, type Cart } from '@/lib/cart';
import Link from 'next/link';
import { closetPieces, markCartBought, receiveCart, type ClosetPiece } from '@/app/(app)/shopping/actions';

export interface NeedsColumn { order: number; sizeId: string; label: string }
export interface CellInfo { goal: number; owned: number; incoming: number }
export interface NeedsRow { categoryId: string; cells: Record<number, number>; /** Goal, closet and on-order counts behind each cell, by size order. */ info?: Record<number, CellInfo> }
export interface TypeInfo { name: string; icon: string }

/**
 * The "Needs by item and size" table, made for shopping in a store. Tap a number to say how many of that item and size are in
 * the cart; the cell then shows what is still to find. A bar at the bottom shows the cart, where lines can be changed, the
 * cart cleared, or everything marked bought (it goes on the shopping list as ordered, so it counts as incoming).
 * The cart is kept on this device only, one per child.
 */
export function NeedsCart({ childId, columns, rows, types, sizeLabels, allSizes }: {
  childId: string;
  columns: NeedsColumn[];
  rows: NeedsRow[];
  types: Record<string, TypeInfo>;
  /** Every size's label by id, for cart lines whose column is not in the table any more. */
  sizeLabels: Record<string, string>;
  /** Every size in order, for adding something not in the table. */
  allSizes: { sizeId: string; label: string }[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart>({});
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<{ categoryId: string; sizeId: string; need: number; info?: CellInfo } | null>(null);
  const [showCart, setShowCart] = useState(false);
  // Counts for a panel opened without them (an extra with no goal): looked up when it opens.
  const [looked, setLooked] = useState<{ key: string; info: CellInfo } | null>(null);
  useEffect(() => {
    if (!open || open.info) return;
    const key = cartKey(open.categoryId, open.sizeId);
    let live = true;
    closetPieces(open.categoryId, open.sizeId)
      .then((res) => { if (live && !res.error) setLooked({ key, info: { goal: 0, owned: res.pieces.reduce((t, p) => t + p.quantity, 0), incoming: 0 } }); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [open]);
  const openInfo = open ? (open.info ?? (looked?.key === cartKey(open.categoryId, open.sizeId) ? looked.info : undefined)) : undefined;
  // The closet pieces behind "N in closet", loaded when tapped.
  const [closet, setCloset] = useState<{ title: string; pieces: ClosetPiece[] | null; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // The name for this shopping trip or order (empty: the date and time).
  const [tripName, setTripName] = useState('');
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);

  // Read the stored cart after the first render (the server cannot see it), and keep it saved on every change.
  useEffect(() => {
    try {
      setCart(parseCart(window.localStorage.getItem(cartStorageKey(childId))));
    } catch {
      // Storage can be unavailable (private mode); the cart then lasts as long as the page.
    }
    setLoaded(true);
  }, [childId]);
  useEffect(() => {
    if (!loaded) return;
    try {
      const key = cartStorageKey(childId);
      if (Object.keys(cart).length) window.localStorage.setItem(key, JSON.stringify(cart));
      else window.localStorage.removeItem(key);
    } catch {
      // See above.
    }
  }, [cart, childId, loaded]);

  const inCart = (categoryId: string, sizeId: string) => cart[cartKey(categoryId, sizeId)] ?? 0;
  const set = (categoryId: string, sizeId: string, n: number) => setCart((c) => setInCart(c, cartKey(categoryId, sizeId), n));
  const needOf = (categoryId: string, sizeId: string) => {
    const col = columns.find((c) => c.sizeId === sizeId);
    return col ? (rows.find((r) => r.categoryId === categoryId)?.cells[col.order] ?? 0) : 0;
  };

  const left = (r: NeedsRow, col: NeedsColumn) => leftToFind(r.cells[col.order] ?? 0, inCart(r.categoryId, col.sizeId));
  const rowLeft = (r: NeedsRow) => columns.reduce((t, col) => t + left(r, col), 0);
  const colLeft = (col: NeedsColumn) => rows.reduce((t, r) => t + left(r, col), 0);
  const allLeft = rows.reduce((t, r) => t + rowLeft(r), 0);
  const lines = cartLines(cart);
  const pieces = cartPieces(cart);

  async function bought() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await markCartBought(lines, tripName.trim() || defaultOrderName());
      if (res.saved.length) setCart((c) => res.saved.reduce((acc, k) => setInCart(acc, k, 0), c));
      setMessage(res.error ? { text: res.error, bad: true } : { text: 'Marked as ordered. It is under Orders on the Shopping page and counts as incoming until it arrives.', bad: false });
      if (!res.error) { setShowCart(false); setTripName(''); }
      router.refresh();
    } catch {
      setMessage({ text: 'Could not reach the server. Your cart is still here; try again when you have signal.', bad: true });
    }
    setSaving(false);
  }

  async function showCloset(categoryId: string, sizeId: string) {
    const title = `${types[categoryId]?.name ?? 'Item'} · ${sizeLabels[sizeId] ?? ''}`;
    setCloset({ title, pieces: null });
    try {
      const res = await closetPieces(categoryId, sizeId);
      setCloset({ title, pieces: res.pieces, error: res.error });
    } catch {
      setCloset({ title, pieces: [], error: 'Your closet could not be loaded. Check your signal and try again.' });
    }
  }

  /** In the store: bought and in hand. Into the closet now (as one trip), then straight on to add photos. */
  async function received() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await receiveCart(lines, tripName.trim() || defaultOrderName());
      if (res.saved.length) setCart((c) => res.saved.reduce((acc, k) => setInCart(acc, k, 0), c));
      if (res.error) setMessage({ text: res.error, bad: true });
      else { setShowCart(false); setTripName(''); }
      if (res.trip) router.push(`/shopping?trip=${res.trip}`);
      else router.refresh();
    } catch {
      setMessage({ text: 'Could not reach the server. Your cart is still here; try again when you have signal.', bad: true });
    }
    setSaving(false);
  }

  function clearCart() {
    if (!window.confirm('Clear the cart? Nothing will be marked as bought.')) return;
    setCart({});
    setShowCart(false);
  }

  const name = (categoryId: string) => types[categoryId]?.name ?? 'Item';
  const icon = (categoryId: string) => types[categoryId]?.icon ?? 'g_other';
  const stepBtn = 'flex size-11 items-center justify-center rounded-full border border-line bg-surface text-xl font-bold disabled:opacity-40';

  return (
    <>
      {message && <p role={message.bad ? 'alert' : 'status'} className={`mt-2 text-sm ${message.bad ? 'text-bad' : 'text-good'}`}>{message.text}</p>}
      {rows.length > 0 && <p className="mt-1 text-sm text-muted">In the store? Tap a number (or a –, for extras) to put pieces in your cart.</p>}
      {rows.length > 0 && <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 bg-surface py-2 pr-3 text-left font-medium text-muted">Item</th>
              {columns.map((col) => <th key={col.order} scope="col" className="px-2 py-2 text-center font-medium text-muted">{col.label}</th>)}
              <th scope="col" className="px-3 py-2 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.categoryId} className="border-t border-line">
                <th scope="row" className="sticky left-0 bg-surface py-2 pr-3 text-left font-medium">
                  <span className="flex items-center gap-1.5"><ItemIcon itemKey={icon(r.categoryId)} size={18} className="shrink-0 text-accent" />{name(r.categoryId)}</span>
                </th>
                {columns.map((col) => {
                  const need = r.cells[col.order];
                  const got = inCart(r.categoryId, col.sizeId);
                  // Nothing needed here (goal met or no goal): still tappable, for buying extra.
                  if (!need) {
                    return (
                      <td key={col.order} className="px-1 py-1 text-center">
                        <button type="button" onClick={() => setOpen({ categoryId: r.categoryId, sizeId: col.sizeId, need: 0, info: r.info?.[col.order] })}
                          aria-label={`${name(r.categoryId)}, ${col.label}: nothing needed${got ? `, ${got} in cart` : ''}`}
                          className={`min-w-11 rounded-lg px-2 py-1.5 text-muted tabular-nums ${got ? 'bg-accent-soft text-ink' : 'hover:bg-line/60'}`}>
                          <span className="block">–</span>
                          {got > 0 && <span className="block text-[11px] leading-tight">🛒 {got}</span>}
                        </button>
                      </td>
                    );
                  }
                  const rest = leftToFind(need, got);
                  return (
                    <td key={col.order} className="px-1 py-1 text-center">
                      <button type="button" onClick={() => setOpen({ categoryId: r.categoryId, sizeId: col.sizeId, need, info: r.info?.[col.order] })}
                        aria-label={`${name(r.categoryId)}, ${col.label}: need ${need}${got ? `, ${got} in cart` : ''}`}
                        className={`min-w-11 rounded-lg px-2 py-1.5 tabular-nums ${got ? (rest === 0 ? 'bg-good-soft text-good' : 'bg-accent-soft') : 'hover:bg-line/60'}`}>
                        <span className="block font-semibold">{rest === 0 ? '✓' : rest}</span>
                        {got > 0 && <span className="block text-[11px] leading-tight">🛒 {got}</span>}
                      </button>
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center font-semibold tabular-nums">{rowLeft(r)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line">
              <th scope="row" className="sticky left-0 bg-surface py-2 pr-3 text-left font-semibold">{pieces ? 'Left to find' : 'Total'}</th>
              {columns.map((col) => <td key={col.order} className="px-2 py-2 text-center font-semibold tabular-nums">{colLeft(col)}</td>)}
              <td className="px-3 py-2 text-center font-bold tabular-nums">{allLeft}</td>
            </tr>
          </tfoot>
        </table>
      </div>}

      <AddOther types={types} sizes={allSizes} onPick={(categoryId, sizeId) => setOpen({ categoryId, sizeId, need: needOf(categoryId, sizeId) })} />

      {/* Room at the end of the page so the cart bar never covers the last lines. */}
      {pieces > 0 && <div aria-hidden="true" className="h-16" />}
      {/* The cart bar, above the phone's bottom navigation. */}
      {pieces > 0 && !open && !showCart && (
        <button type="button" onClick={() => setShowCart(true)}
          className="fixed inset-x-3 bottom-[calc(var(--nav-h,0px)+0.75rem)] z-30 mx-auto flex max-w-md items-center justify-between rounded-full bg-accent px-5 py-3 text-accent-ink shadow-lg md:bottom-6">
          <span>🛒 Cart: <b>{pieces}</b> piece{pieces === 1 ? '' : 's'}, {lines.length} item{lines.length === 1 ? '' : 's'}</span>
          <span className="font-bold underline">View</span>
        </button>
      )}

      {/* One item and size: how many are in the cart. */}
      {open && (
        <Sheet onClose={() => setOpen(null)} label={`${name(open.categoryId)} in the cart`}>
          <div className="flex items-center gap-3">
            <span className="text-accent"><ItemIcon itemKey={icon(open.categoryId)} size={40} /></span>
            <div>
              <p className="font-display text-lg font-bold">{name(open.categoryId)}</p>
              <p className="text-sm text-muted">{sizeLabels[open.sizeId] ?? ''} · {open.need ? `Need ${open.need}` : 'Not needed for your goals'}</p>
              {openInfo ? (
                <p className="text-xs text-muted">
                  Goal {openInfo.goal} ·{' '}
                  {openInfo.owned > 0
                    ? <button type="button" className="text-accent underline" onClick={() => showCloset(open.categoryId, open.sizeId)}>{openInfo.owned} in closet</button>
                    : '0 in closet'}
                  {openInfo.incoming > 0 ? ` · ${openInfo.incoming} on order` : ''}
                </p>
              ) : <p className="text-xs text-muted">Checking the closet…</p>}
            </div>
          </div>
          <div className="flex items-center justify-center gap-5 py-2">
            <button type="button" className={stepBtn} aria-label="One fewer" disabled={inCart(open.categoryId, open.sizeId) === 0}
              onClick={() => set(open.categoryId, open.sizeId, inCart(open.categoryId, open.sizeId) - 1)}>−</button>
            <div className="text-center">
              <span className="block font-display text-4xl font-bold tabular-nums" aria-live="polite">{inCart(open.categoryId, open.sizeId)}</span>
              <span className="text-sm text-muted">in cart</span>
            </div>
            <button type="button" className={stepBtn} aria-label="One more" disabled={inCart(open.categoryId, open.sizeId) >= MAX_IN_CART}
              onClick={() => set(open.categoryId, open.sizeId, inCart(open.categoryId, open.sizeId) + 1)}>+</button>
          </div>
          <p className="text-center text-sm text-muted">
            {open.need === 0 ? 'Extra: this is beyond your goals, and that is fine.'
              : leftToFind(open.need, inCart(open.categoryId, open.sizeId)) === 0 ? 'That covers it.' : `${leftToFind(open.need, inCart(open.categoryId, open.sizeId))} still to find.`}
          </p>
          <div className="flex items-center justify-between gap-3 pt-1">
            {inCart(open.categoryId, open.sizeId) > 0
              ? <button type="button" className="text-sm text-bad underline" onClick={() => { set(open.categoryId, open.sizeId, 0); setOpen(null); }}>Remove from cart</button>
              : <span />}
            <button type="button" className={btnCls} onClick={() => setOpen(null)}>Done</button>
          </div>
        </Sheet>
      )}

      {/* What is already in the closet for that item and size. Opens over the cart panel; closing returns to it. */}
      {closet && (
        <Sheet onClose={() => setCloset(null)} label="In the closet">
          <h2 className="font-display text-lg font-bold">In the closet</h2>
          <p className="-mt-2 text-sm text-muted">{closet.title}</p>
          {closet.pieces === null ? (
            <p className="py-4 text-center text-muted">Loading…</p>
          ) : (
            <ul className="max-h-[50vh] overflow-y-auto">
              {closet.pieces.map((p) => (
                <li key={p.id} className="border-t border-line first:border-t-0">
                  <Link href={`/closet/${p.id}?back=${encodeURIComponent('/shopping')}`} className="flex items-center gap-3 py-2">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className={`size-14 shrink-0 rounded-lg bg-line ${p.cutout ? 'object-contain' : 'object-cover'}`} />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-line/60 text-accent"><ItemIcon itemKey={open ? icon(open.categoryId) : 'g_other'} size={30} /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{p.name}</b>
                      <span className="block text-xs text-muted">{[p.brand, `Fits ${p.fits}`].filter(Boolean).join(' · ')}</span>
                    </span>
                    {p.quantity > 1 && <span className="rounded-full bg-line px-2 text-xs">×{p.quantity}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {closet.error && <p role="alert" className="text-sm text-bad">{closet.error}</p>}
          {closet.pieces?.length === 0 && !closet.error && <p className="py-3 text-center text-muted">Nothing in the closet counts toward this size.</p>}
          <div className="flex justify-end"><button type="button" className={btnCls} onClick={() => setCloset(null)}>Back</button></div>
        </Sheet>
      )}

      {/* The whole cart. */}
      {showCart && (
        <Sheet onClose={() => setShowCart(false)} label="Cart">
          <h2 className="font-display text-lg font-bold">Cart · {pieces} piece{pieces === 1 ? '' : 's'}</h2>
          <ul className="max-h-[45vh] overflow-y-auto">
            {lines.map((l) => {
              const need = needOf(l.categoryId, l.sizeId);
              return (
                <li key={cartKey(l.categoryId, l.sizeId)} className="flex items-center gap-2 border-t border-line py-2 first:border-t-0">
                  <span className="shrink-0 text-accent"><ItemIcon itemKey={icon(l.categoryId)} size={24} /></span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate">{name(l.categoryId)}</b>
                    <span className="text-xs text-muted">{sizeLabels[l.sizeId] ?? ''}{need ? ` · need ${need}` : ''}</span>
                  </span>
                  <button type="button" className="flex size-9 items-center justify-center rounded-full border border-line" aria-label="One fewer" onClick={() => set(l.categoryId, l.sizeId, l.qty - 1)}>−</button>
                  <b className="w-6 text-center tabular-nums">{l.qty}</b>
                  <button type="button" className="flex size-9 items-center justify-center rounded-full border border-line" aria-label="One more" disabled={l.qty >= MAX_IN_CART} onClick={() => set(l.categoryId, l.sizeId, l.qty + 1)}>+</button>
                  <button type="button" className="ml-1 text-sm text-bad underline" onClick={() => set(l.categoryId, l.sizeId, 0)} aria-label={`Remove ${name(l.categoryId)} from cart`}>Remove</button>
                </li>
              );
            })}
          </ul>
          {lines.length === 0 && <p className="py-3 text-center text-muted">The cart is empty.</p>}
          {lines.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <label className="flex flex-col gap-1 text-sm font-medium">Name (optional)
                <input className={inputCls} value={tripName} maxLength={80} placeholder={defaultOrderName()} onChange={(e) => setTripName(e.target.value)} />
              </label>
              <button type="button" className={btnCls} disabled={saving} onClick={received}>{saving ? 'Saving…' : 'Bought & received'}</button>
              <p className="text-xs text-muted">Puts these in your closet now as one shopping trip, then offers to add photos and details.</p>
              <button type="button" className={btnGhostCls} disabled={saving} onClick={bought}>Mark ordered (not here yet)</button>
              <div className="flex justify-between">
                <button type="button" className="text-sm text-bad underline" onClick={clearCart}>Clear cart</button>
                <button type="button" className={btnGhostCls} onClick={() => setShowCart(false)}>Close</button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

/** For anything not in the table (no goal for that item type): pick an item type and size, then set how many are in the cart. */
function AddOther({ types, sizes, onPick }: { types: Record<string, TypeInfo>; sizes: { sizeId: string; label: string }[]; onPick: (categoryId: string, sizeId: string) => void }) {
  const [cat, setCat] = useState('');
  const [size, setSize] = useState('');
  const sorted = Object.entries(types).sort((a, b) => a[1].name.localeCompare(b[1].name));
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
      <p className="w-full text-sm text-muted">Buying something not in the table?</p>
      <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Item type">
        <option value="">Item type…</option>
        {sorted.map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
      </select>
      <select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Size">
        <option value="">Size…</option>
        {sizes.map((z) => <option key={z.sizeId} value={z.sizeId}>{z.label}</option>)}
      </select>
      <button type="button" className={btnGhostCls} disabled={!cat || !size} onClick={() => onPick(cat, size)}>Add to cart</button>
    </div>
  );
}

