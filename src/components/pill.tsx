const tones: Record<string, string> = {
  fits: 'bg-good-soft text-good',
  notyet: 'bg-accent-soft text-accent',
  outgrown: 'bg-line text-muted',
  unknown: 'bg-line text-muted',
  neutral: 'bg-line text-muted',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
  good: 'bg-good-soft text-good',
};

export function Pill({ tone = 'neutral', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone] ?? tones.neutral}`}>{children}</span>;
}
