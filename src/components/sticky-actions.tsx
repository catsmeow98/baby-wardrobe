/**
 * A form's main buttons (Save, Cancel...), kept in view at the bottom of the screen while the form scrolls, just above the
 * phone's bottom menu (whose height the menu publishes as --nav-h; 0 where there is none). Put it last in the form. Inside a
 * padded card, the default -mx-4 makes the bar span the card's width.
 */
export function StickyActions({ children, className = '-mx-4 px-4', full = false }: {
  children: React.ReactNode;
  className?: string;
  /** On a full-screen view that covers the bottom menu: sit at the very bottom, clear of the phone's navigation bar. */
  full?: boolean;
}) {
  const place = full ? 'bottom-0 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]' : 'bottom-[var(--nav-h,0px)] py-3';
  return (
    <div className={`sticky z-20 flex flex-wrap items-center gap-3 border-t border-line bg-bg/95 backdrop-blur ${place} ${className}`}>
      {children}
    </div>
  );
}
