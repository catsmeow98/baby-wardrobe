export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <p className="font-display text-2xl font-bold">Baby Wardrobe</p>
      <div className="rounded-xl border border-line bg-surface p-5">{children}</div>
    </main>
  );
}
