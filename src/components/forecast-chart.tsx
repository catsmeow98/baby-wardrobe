import { lengthAt, UPPER, type Forecast, type Sex } from '@/lib/domain';

const W = 640;
const H = 300;
const PAD = { l: 40, r: 12, t: 14, b: 26 };
const Z97 = 1.881;

/**
 * The growth chart: the 3rd, 50th and 97th percentile lines, the measurements, today, the projection (dashed) with its likely
 * range (shaded), and dashed lines where the chosen size chart moves up a size. Drawn on the server as plain SVG.
 */
export function ForecastChart({ f, sex, offset, sizeLabel }: {
  f: Forecast;
  sex: Sex;
  /** The chosen brand's offset in inches (0 for the standard chart). */
  offset: number;
  /** Size name by size order, for labelling the size lines. */
  sizeLabel: (order: number) => string;
}) {
  const nowAge = f.rows[0].age;
  const endAge = f.rows[f.rows.length - 1].age;
  const startAge = Math.max(0, Math.floor(Math.min(nowAge, ...f.points.map((p) => p.age)) - 1));
  const span = Math.max(1, endAge - startAge);
  const ages = Array.from({ length: 41 }, (_, i) => startAge + (span * i) / 40);
  const curve = (z: number) => ages.map((a) => [a, lengthAt(sex, a, z)] as const);
  const lines = { p3: curve(-Z97), p50: curve(0), p97: curve(Z97) };

  const ys = [...lines.p3.map((p) => p[1]), ...lines.p97.map((p) => p[1]), ...f.rows.flatMap((r) => [r.low, r.high]), ...f.points.map((p) => p.lengthIn)];
  const yMin = Math.floor(Math.min(...ys) / 2) * 2;
  const yMax = Math.ceil(Math.max(...ys) / 2) * 2;
  const x = (a: number) => PAD.l + ((a - startAge) / span) * (W - PAD.l - PAD.r);
  const y = (inch: number) => H - PAD.b - ((inch - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = (pts: readonly (readonly [number, number])[]) => pts.map(([a, v], i) => `${i ? 'L' : 'M'}${x(a).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const band = `${path(f.rows.map((r) => [r.age, r.high] as const))} ${f.rows.slice().reverse().map((r) => `L${x(r.age).toFixed(1)},${y(r.low).toFixed(1)}`).join(' ')} Z`;

  const yTicks = Array.from({ length: (yMax - yMin) / 2 + 1 }, (_, i) => yMin + i * 2);
  const step = span > 15 ? 6 : 3;
  const xTicks: number[] = [];
  for (let a = Math.ceil(startAge / step) * step; a <= endAge; a += step) xTicks.push(a);
  // Size lines: the top of each size on the chosen chart, where it falls inside the chart.
  const sizeLines = UPPER.map((u, g) => ({ g, at: u + offset })).filter((s) => s.at > yMin && s.at < yMax);
  const label = (pts: readonly (readonly [number, number])[], text: string) => {
    const [a, v] = pts[2];
    return <text x={x(a) + 2} y={y(v) - 3} className="fill-muted" fontSize="10">{text}</text>;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Growth chart from ${Math.round(startAge)} to ${Math.round(endAge)} months: measurements, the projected length and the 3rd, 50th and 97th percentiles.`}>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="0.5" />
          <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" className="fill-muted">{t}&quot;</text>
        </g>
      ))}
      {sizeLines.map((s) => (
        <g key={s.g}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(s.at)} y2={y(s.at)} stroke="var(--color-warn)" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.7" />
          {sizeLabel(s.g + 1) && <text x={W - PAD.r - 2} y={y(s.at) - 3} textAnchor="end" fontSize="9" className="fill-muted">{sizeLabel(s.g + 1)} above</text>}
        </g>
      ))}
      {xTicks.map((a) => (
        <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fontSize="10" className="fill-muted">{a} mo</text>
      ))}

      <path d={path(lines.p3)} fill="none" stroke="var(--color-muted)" strokeWidth="0.8" opacity="0.6" />
      <path d={path(lines.p50)} fill="none" stroke="var(--color-muted)" strokeWidth="0.8" opacity="0.6" />
      <path d={path(lines.p97)} fill="none" stroke="var(--color-muted)" strokeWidth="0.8" opacity="0.6" />
      {label(lines.p3, '3rd')}
      {label(lines.p50, '50th')}
      {label(lines.p97, '97th')}

      <path d={band} fill="var(--color-accent)" opacity="0.18" />
      <path d={path(f.rows.map((r) => [r.age, r.mid] as const))} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeDasharray="6 4" />

      <line x1={x(nowAge)} x2={x(nowAge)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-muted)" strokeWidth="0.8" />
      <text x={x(nowAge) + 4} y={PAD.t + 8} fontSize="10" className="fill-muted">today</text>

      {f.points.map((p, i) => (
        <circle key={i} cx={x(p.age)} cy={y(p.lengthIn)} r="4" fill="var(--color-accent)">
          <title>{`${p.lengthIn} in at ${p.age.toFixed(1)} months`}</title>
        </circle>
      ))}
    </svg>
  );
}
