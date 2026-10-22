import { type ReactNode, useRef, useState } from 'react'
import { daysBetween, parseLocalDate } from '../engine/day'
import type { Point } from '../engine/stats'
import { Card, CardTitle } from './ui'

// 직접 그린 SVG 차트. 선 2px, 점 8px(바탕색 2px 테두리), 막대 24px 이하·윗면 4px 둥글게, 격자는 1px 실선.
// 색은 index.css의 --series-1/2 (dataviz 검증 팔레트), 글자는 글자색 토큰만 쓴다.

const W = 340
const PAD = { l: 34, r: 40, t: 12, b: 22 }

const md = (date: string) => {
  const d = parseLocalDate(date)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min]
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  // 마지막 눈금이 최댓값 이상이 되도록 올림 (막대·기준선이 축 밖으로 나가지 않게)
  const start = Math.floor(min / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/** 제목·표 보기 토글을 갖춘 차트 카드. 표는 툴팁 없이도 모든 값을 볼 수 있게 한다 */
export function ChartCard({ title, right, children, table }: { title: string; right?: ReactNode; children: ReactNode; table: { head: string[]; rows: (string | number)[][] } }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <Card>
      <CardTitle
        right={
          <div className="flex items-center gap-2">
            {right}
            <button type="button" className="rounded-lg bg-soft px-2 py-1 text-xs text-muted" onClick={() => setShowTable((v) => !v)}>
              {showTable ? '그래프' : '표'}
            </button>
          </div>
        }
      >
        {title}
      </CardTitle>
      {showTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                {table.head.map((h) => (
                  <th key={h} className="py-1 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...table.rows].reverse().map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((c, j) => (
                    <td key={j} className="py-1">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </Card>
  )
}

export function EmptyChart({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted">{text}</p>
}

export interface LineSeries {
  name: string
  color: 'series-1' | 'series-2'
  points: Point[]
  style: 'line' | 'dots'
}

/** 시간 축 선 그래프. 누르거나 올리면 세로선과 함께 그 날짜의 모든 계열 값을 보여준다 */
export function LineChart({ series, unit, decimals = 1, height = 170 }: { series: LineSeries[]; unit: string; decimals?: number; height?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return <EmptyChart text="아직 기록이 없습니다." />
  const dates = [...new Set(all.map((p) => p.x))].sort()
  const x0 = dates[0]
  const span = Math.max(1, daysBetween(x0, dates.at(-1)!))
  const ys = all.map((p) => p.y)
  const pad = Math.max((Math.max(...ys) - Math.min(...ys)) * 0.15, 10 ** -decimals)
  const ticks = niceTicks(Math.min(...ys) - pad, Math.max(...ys) + pad)
  const lo = Math.min(ticks[0], Math.min(...ys))
  const hi = Math.max(ticks.at(-1)!, Math.max(...ys))
  const innerW = W - PAD.l - PAD.r
  const innerH = height - PAD.t - PAD.b
  const sx = (d: string) => PAD.l + (dates.length === 1 ? innerW / 2 : (daysBetween(x0, d) / span) * innerW)
  const sy = (v: number) => PAD.t + (hi === lo ? innerH / 2 : (1 - (v - lo) / (hi - lo)) * innerH)
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit}`

  const pick = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const x = ((clientX - box.left) / box.width) * W
    let best = dates[0]
    for (const d of dates) if (Math.abs(sx(d) - x) < Math.abs(sx(best) - x)) best = d
    setHover(best)
  }

  const valueAt = (s: LineSeries, d: string) => {
    if (s.points.length === 0) return undefined
    return s.points.reduce((a, b) => (Math.abs(daysBetween(b.x, d)) < Math.abs(daysBetween(a.x, d)) ? b : a))
  }
  const main = series[0]
  const last = main.points.at(-1)

  return (
    <div className="relative">
      {series.length > 1 && (
        <div className="mb-1 flex gap-4 text-xs text-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              {s.style === 'line' ? (
                <span className="inline-block h-0.5 w-4 rounded" style={{ background: `var(--${s.color})` }} />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: `var(--${s.color})` }} />
              )}
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-pan-y select-none"
        role="img"
        aria-label={`${main.name} 그래프`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="tabular">
              {t}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={height - 6} fontSize={10} fill="var(--muted)">
          {md(dates[0])}
        </text>
        {dates.length > 1 && (
          <text x={W - PAD.r} y={height - 6} fontSize={10} fill="var(--muted)" textAnchor="end">
            {md(dates.at(-1)!)}
          </text>
        )}
        {series.map((s) =>
          s.style === 'line' ? (
            <polyline
              key={s.name}
              points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={`var(--${s.color})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <g key={s.name}>
              {s.points.map((p) => (
                <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={3} fill={`var(--${s.color})`} opacity={0.55} />
              ))}
            </g>
          ),
        )}
        {last && (
          <>
            <circle cx={sx(last.x)} cy={sy(last.y)} r={4} fill={`var(--${main.color})`} stroke="var(--card)" strokeWidth={2} />
            <text x={sx(last.x) + 7} y={sy(last.y) + 3} fontSize={10} fill="var(--ink)" className="tabular">
              {last.y.toFixed(decimals)}
            </text>
          </>
        )}
        {hover && <line x1={sx(hover)} x2={sx(hover)} y1={PAD.t} y2={height - PAD.b} stroke="var(--muted)" strokeWidth={1} />}
        {hover &&
          series.map((s) => {
            const v = valueAt(s, hover)
            return v && v.x === hover ? <circle key={s.name} cx={sx(v.x)} cy={sy(v.y)} r={4} fill={`var(--${s.color})`} stroke="var(--card)" strokeWidth={2} /> : null
          })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-6 rounded-lg border border-line bg-card px-2 py-1 text-xs shadow"
          style={{ left: `${Math.min(70, Math.max(0, (sx(hover) / W) * 100 - 10))}%` }}
        >
          <p className="text-muted">{md(hover)}</p>
          {series.map((s) => {
            const v = valueAt(s, hover)
            return v ? (
              <p key={s.name} className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-3 rounded" style={{ background: `var(--${s.color})` }} />
                <b className="tabular">{fmt(v.y)}</b>
                <span className="text-muted">{s.name}</span>
              </p>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}

/** 주간 막대 그래프. 기준선(목표·권고)을 가는 선으로 함께 그린다 */
export function ColumnChart({
  data,
  unit,
  decimals = 0,
  target,
  height = 150,
}: {
  data: { label: string; value: number | null }[]
  unit: string
  decimals?: number
  target?: { value: number; label: string }
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  if (data.every((d) => !d.value)) return <EmptyChart text="아직 기록이 없습니다." />
  const max = Math.max(...data.map((d) => d.value ?? 0), target?.value ?? 0)
  const ticks = niceTicks(0, max, 3)
  const hi = ticks.at(-1)!
  const innerW = W - PAD.l - PAD.r
  const innerH = height - PAD.t - PAD.b
  const band = innerW / data.length
  const bw = Math.min(24, band - 4)
  const sy = (v: number) => PAD.t + (1 - v / hi) * innerH
  const base = sy(0)
  const lastIdx = data.length - 1

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="w-full select-none" role="img" aria-label="주간 막대 그래프" onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" className="tabular">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD.l + band * i + band / 2
          const v = d.value ?? 0
          const top = sy(v)
          const h = base - top
          const r = Math.min(4, h)
          const x = cx - bw / 2
          return (
            <g key={d.label} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
              <rect x={PAD.l + band * i} y={PAD.t} width={band} height={innerH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z`}
                  fill="var(--series-1)"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {(i % 2 === lastIdx % 2 || data.length <= 6) && (
                <text x={cx} y={height - 6} fontSize={10} fill="var(--muted)" textAnchor="middle">
                  {d.label}
                </text>
              )}
              {i === lastIdx && d.value !== null && (
                <text x={cx} y={top - 4} fontSize={10} fill="var(--ink)" textAnchor="middle" className="tabular">
                  {v.toFixed(decimals)}
                </text>
              )}
            </g>
          )
        })}
        {target && (
          <>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(target.value)} y2={sy(target.value)} stroke="var(--ink)" strokeWidth={1} opacity={0.6} />
            <text x={W - PAD.r + 4} y={sy(target.value) + 3} fontSize={10} fill="var(--muted)">
              {target.label}
            </text>
          </>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-line bg-card px-2 py-1 text-xs shadow"
          style={{ left: `${Math.min(70, Math.max(0, ((PAD.l + band * hover) / W) * 100 - 5))}%` }}
        >
          <p className="text-muted">{data[hover].label} 주</p>
          <b className="tabular">{data[hover].value === null ? '기록 없음' : `${data[hover].value!.toFixed(decimals)}${unit}`}</b>
        </div>
      )}
    </div>
  )
}
