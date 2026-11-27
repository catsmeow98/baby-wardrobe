/** Covers the page, tab bar included, so a task such as the goal survey gets the whole screen. */
export function FocusShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg pt-[var(--safe-top)]">
      <div className={`mx-auto flex flex-col gap-4 px-4 pb-[calc(4rem+var(--safe-bottom))] pt-3 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>{children}</div>
    </div>
  );
}
