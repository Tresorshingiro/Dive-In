import { useId, useMemo, useState } from 'react';

/** Validated for the dark surface (dataviz validator: lightness band, CVD ΔE 26, contrast ≥ 3:1). */
export const CHART = { gold: '#B98818', blue: '#3B82D6', magenta: '#C0508A', grid: '#232323', axis: '#77736B', surface: '#141414' };

export interface Series {
  key: string;
  label: string;
  color: string;
}

interface Props {
  title: string;
  /** one row per bar */
  data: Array<{ label: string; tooltipLabel?: string; values: Record<string, number> }>;
  series: Series[];
  /** show every n-th x label */
  labelEvery?: number;
  format?: (n: number) => string;
  height?: number;
}

const W = 640;
const PAD = { top: 12, right: 8, bottom: 26, left: 48 };

function niceMax(v: number) {
  if (v <= 0) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Path for a bar whose top corners are rounded (r) and whose base sits square on the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Vertical bars, stacked when given several series. SVG, no library; hover + keyboard tooltip; table view. */
export function BarChart({ title, data, series, labelEvery = 1, format = (n) => n.toLocaleString('en-US'), height = 220 }: Props) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const totals = data.map((d) => series.reduce((s, se) => s + (d.values[se.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [0, max / 2, max];
  const step = innerW / Math.max(data.length, 1);
  const gap = Math.max(2, Math.min(step * 0.35, 18)); // ≥ 2px surface gap between bars
  const bw = Math.max(step - gap, 2);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const bars = useMemo(
    () =>
      data.map((d, i) => {
        let acc = 0;
        const x = PAD.left + i * step + gap / 2;
        const segs = series.map((se, si) => {
          const v = d.values[se.key] ?? 0;
          const y1 = y(acc + v);
          const y0 = y(acc);
          acc += v;
          const top = si === series.length - 1 || series.slice(si + 1).every((s2) => !(d.values[s2.key] ?? 0));
          // 2px surface gap between stacked segments
          const h = Math.max(0, y0 - y1 - (si > 0 && v > 0 ? 2 : 0));
          return { se, v, d: top ? barPath(x, y1, bw, h, 4) : `M${x},${y1}h${bw}v${h}h${-bw}Z` };
        });
        return { x, segs };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, series, max, step, gap, bw],
  );

  const h = hover !== null ? data[hover] : null;
  const tipX = hover !== null ? ((bars[hover].x + bw / 2) / W) * 100 : 0;

  return (
    <figure className="m-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-sm font-bold text-text">{title}</figcaption>
        <div className="flex items-center gap-4">
          {series.length > 1 && (
            <ul className="m-0 flex list-none gap-4 p-0 text-xs text-muted" aria-label="Legend">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="text-xs font-semibold text-gold" onClick={() => setTable((t) => !t)} aria-expanded={table} aria-controls={`${id}-table`}>
            {table ? 'Show chart' : 'Show table'}
          </button>
        </div>
      </div>

      {table ? (
        <div id={`${id}-table`} className="max-h-[260px] overflow-y-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-faint">
              <tr>
                <th className="px-3 py-2 font-bold">Period</th>
                {series.map((s) => <th key={s.key} className="px-3 py-2 text-right font-bold">{s.label}</th>)}
                {series.length > 1 && <th className="px-3 py-2 text-right font-bold">Total</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.label} className="border-t border-line-soft">
                  <td className="px-3 py-1.5 text-chalk">{d.tooltipLabel ?? d.label}</td>
                  {series.map((s) => <td key={s.key} className="px-3 py-1.5 text-right tabular-nums text-chalk">{format(d.values[s.key] ?? 0)}</td>)}
                  {series.length > 1 && <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{format(totals[i])}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}. Use “Show table” for the values.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={CHART.axis} fontFamily="Inter, sans-serif">{format(t)}</text>
              </g>
            ))}
            {bars.map((b, i) => (
              <g key={i} opacity={hover === null || hover === i ? 1 : 0.45} style={{ transition: 'opacity .15s' }}>
                {b.segs.map((s) => s.v > 0 && <path key={s.se.key} d={s.d} fill={s.se.color} />)}
              </g>
            ))}
            {data.map((d, i) =>
              i % labelEvery === 0 || i === data.length - 1 ? (
                <text key={d.label} x={bars[i].x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill={CHART.axis} fontFamily="Inter, sans-serif">{d.label}</text>
              ) : null,
            )}
            {/* hit targets: the full column, bigger than the mark */}
            {data.map((d, i) => (
              <rect
                key={`hit-${d.label}`}
                x={PAD.left + i * step}
                y={PAD.top}
                width={step}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.tooltipLabel ?? d.label}: ${series.map((s) => `${s.label} ${format(d.values[s.key] ?? 0)}`).join(', ')}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                style={{ outline: 'none', cursor: 'default' }}
              />
            ))}
          </svg>
          {h && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border border-line-2 bg-ink px-3 py-2 text-xs whitespace-nowrap shadow-[0_12px_30px_-10px_rgba(0,0,0,.9)]"
              style={{ left: `clamp(70px, ${tipX}%, calc(100% - 70px))` }}
            >
              <div className="mb-1 font-bold text-text">{h.tooltipLabel ?? h.label}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-2 text-chalk">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} />
                  {s.label}
                  <span className="ml-auto pl-3 font-semibold tabular-nums text-text">{format(h.values[s.key] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
