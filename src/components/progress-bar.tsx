export function ProgressBar({ owned, incoming, goal }: { owned: number; incoming: number; goal: number }) {
  const d = Math.max(goal, 1);
  const a = Math.min(100, (owned / d) * 100);
  const b = Math.min(100 - a, (incoming / d) * 100);
  return (
    <div role="img" aria-label={`${owned} owned, ${incoming} incoming, goal ${goal}`} className="flex h-2 overflow-hidden rounded-full bg-line">
      <span className="bg-accent" style={{ width: `${a}%` }} />
      <span className="bg-accent opacity-40" style={{ width: `${b}%` }} />
    </div>
  );
}
