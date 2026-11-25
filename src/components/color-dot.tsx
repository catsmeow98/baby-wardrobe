import { COLORS } from '@/lib/db';

/** A small round swatch for an item color. Multicolor shows as a color wheel. */
export function ColorDot({ color, className = '' }: { color: string | null | undefined; className?: string }) {
  const c = COLORS.find(([v]) => v === color);
  if (!c) return null;
  return (
    <span
      role="img"
      aria-label={c[1]}
      title={c[1]}
      className={`inline-block size-3 rounded-full border border-line align-middle ${className}`}
      style={{ background: c[0] === 'multicolor' ? 'conic-gradient(#ef4444, #facc15, #22c55e, #3b82f6, #8b5cf6, #ef4444)' : c[2] }}
    />
  );
}
