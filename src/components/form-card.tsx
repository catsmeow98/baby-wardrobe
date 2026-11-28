/** A titled card that groups fields on the item forms (What is it, Size, How it looks). */
export function FormCard({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 ${className}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** The More card: folded, with a one-line summary of what is inside. */
export function MoreCard({ summary, open = false, children, className = '' }: { summary: string; open?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <details open={open} className={`group rounded-xl border border-line bg-surface px-3.5 ${className}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">More</span>
          <span className="text-sm text-muted">{summary}</span>
        </span>
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="flex flex-col gap-4 pb-4 pt-1">{children}</div>
    </details>
  );
}
