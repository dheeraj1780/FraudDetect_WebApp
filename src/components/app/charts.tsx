import { Table2, BarChart3 } from "lucide-react"
import { useId, useState } from "react"
import { DataTable } from "@/components/ui/data-table"
import { SEVERITY_STYLES, type Severity } from "@/lib/fraud/vocabulary"
import type { SampleSummary } from "@/lib/fraud/sample"
import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Risk activity — stacked daily columns by risk band                  */
/* ------------------------------------------------------------------ */

const CHART_BANDS: Severity[] = ["LOW", "MEDIUM", "HIGH"]
const W = 640
const H = 200
const PAD = { top: 8, right: 8, bottom: 22, left: 30 }

function niceMax(value: number) {
  if (value <= 4) return 4
  const step = value <= 10 ? 2 : value <= 20 ? 5 : 10
  return Math.ceil(value / step) * step
}

function shortDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
}

function BandLegend({ bands }: { bands: Severity[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted" aria-label="Legend">
      {bands.map((band) => (
        <li key={band} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[2px]", SEVERITY_STYLES[band].bar)} />
          {SEVERITY_STYLES[band].label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Assessments per day, stacked by risk band. Thin columns with a 2px surface gap between
 * segments; recessive grid; a legend (never colour alone: label + tooltip + table view);
 * columns are keyboard-focusable and show the same tooltip on focus as on hover.
 */
export function RiskActivityChart({ summary }: { summary: SampleSummary }) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()

  const days = summary.perDay
  const max = niceMax(Math.max(1, ...days.map((d) => d.total)))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / days.length
  const barW = Math.min(18, slot * 0.6)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const ticks = [0, max / 2, max]
  const activeDay = active !== null ? days[active] : null

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <BandLegend bands={CHART_BANDS} />
        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          aria-pressed={view === "table"}
          aria-controls={tableId}
          className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2 py-1 text-xs text-fg-muted hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {view === "chart" ? <Table2 size={12} aria-hidden="true" /> : <BarChart3 size={12} aria-hidden="true" />}
          {view === "chart" ? "View as table" : "View as chart"}
        </button>
      </div>

      <div id={tableId}>
        {view === "table" ? (
          <DataTable
            caption="Assessments per day by risk band (sample data)"
            rows={days}
            getRowKey={(d) => d.day}
            columns={[
              { key: "day", header: "Day", cell: (d) => shortDay(d.day) },
              ...CHART_BANDS.map((band) => ({
                key: band,
                header: SEVERITY_STYLES[band].label,
                cell: (d: (typeof days)[number]) => d.counts[band],
                className: "tabular-nums",
              })),
              { key: "total", header: "Total", cell: (d) => d.total, className: "tabular-nums" },
            ]}
          />
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={`Assessments per day for the last ${days.length} days, stacked by risk band. Use the table view for exact values.`}
              className="h-auto w-full"
              onMouseLeave={() => setActive(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
                  <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-fg-subtle)">
                    {t}
                  </text>
                </g>
              ))}
              {days.map((d, i) => {
                const cx = PAD.left + slot * i + slot / 2
                let acc = 0
                const isActive = active === i
                return (
                  <g
                    key={d.day}
                    tabIndex={0}
                    role="group"
                    aria-label={`${shortDay(d.day)}: ${d.total} assessments (${CHART_BANDS.map((b) => `${d.counts[b]} ${SEVERITY_STYLES[b].label.toLowerCase()}`).join(", ")})`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="outline-none [&:focus-visible>rect.focus]:stroke-accent"
                  >
                    <rect
                      className="focus"
                      x={cx - slot / 2 + 1}
                      y={PAD.top}
                      width={slot - 2}
                      height={innerH}
                      fill={isActive ? "var(--color-panel-hover)" : "transparent"}
                      stroke="transparent"
                      strokeWidth="1.5"
                      rx="3"
                    />
                    {CHART_BANDS.map((band) => {
                      const count = d.counts[band]
                      if (count === 0) return null
                      const top = y(acc + count)
                      const h = y(acc) - top
                      acc += count
                      return (
                        <rect
                          key={band}
                          x={cx - barW / 2}
                          y={top}
                          width={barW}
                          height={Math.max(h, 1)}
                          rx="2"
                          fill={SEVERITY_STYLES[band].color}
                          stroke="var(--color-panel)"
                          strokeWidth="2"
                        />
                      )
                    })}
                    {i % 2 === 0 ? (
                      <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">
                        {shortDay(d.day)}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>

            {activeDay ? (
              <div
                role="status"
                className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-control border border-line-strong bg-panel-raised px-3 py-2 text-xs shadow-overlay"
                style={{ left: `clamp(0%, ${((PAD.left + slot * (active ?? 0) + slot / 2) / W) * 100}%, 78%)` }}
              >
                <p className="mb-1 font-medium text-fg">{shortDay(activeDay.day)}</p>
                <ul className="flex flex-col gap-0.5">
                  {CHART_BANDS.map((band) => (
                    <li key={band} className="flex items-center justify-between gap-4 text-fg-muted">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden="true" className={cn("h-2 w-2 rounded-[2px]", SEVERITY_STYLES[band].bar)} />
                        {SEVERITY_STYLES[band].label}
                      </span>
                      <span className="font-mono text-fg">{activeDay.counts[band]}</span>
                    </li>
                  ))}
                  <li className="mt-0.5 flex justify-between gap-4 border-t border-line pt-1 text-fg-muted">
                    <span>Total</span>
                    <span className="font-mono text-fg">{activeDay.total}</span>
                  </li>
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Bar list — distributions and rankings                               */
/* ------------------------------------------------------------------ */

export interface BarListItem {
  key: string
  label: string
  value: number
  /** Tailwind background class for the bar (a severity/status token). Defaults to the accent. */
  barClass?: string
  /** Mono secondary label, e.g. a rule id. */
  hint?: string
}

/**
 * Horizontal bars with the label and exact value always printed — colour is never the only
 * carrier. Percentages are of the list total unless `total` is given.
 */
export function BarList({ items, total, ariaLabel }: { items: BarListItem[]; total?: number; ariaLabel: string }) {
  const sum = total ?? items.reduce((n, item) => n + item.value, 0)
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-3">
      {items.map((item) => {
        const pct = sum > 0 ? Math.round((item.value / sum) * 100) : 0
        return (
          <li key={item.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 text-fg">
                {item.label}
                {item.hint ? <span className="ml-2 font-mono text-[11px] text-fg-subtle">{item.hint}</span> : null}
              </span>
              <span className="shrink-0 font-mono text-xs text-fg-muted">
                {item.value.toLocaleString()} <span className="text-fg-subtle">· {pct}%</span>
              </span>
            </div>
            <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", item.barClass ?? "bg-accent")}
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/* Assessment volume — single-series daily columns (real analytics)   */
/* ------------------------------------------------------------------ */

export interface VolumePoint {
  /** ISO date or datetime; only the date portion is used. */
  bucketStart: string
  count: number
}

/**
 * Plain daily volume — one bar per day, no risk-band breakdown (the real aggregate API
 * reports total count per day only; `RiskActivityChart` above is sample-mode-only, where a
 * per-band daily breakdown genuinely exists). Days with zero assessments are NOT present in
 * `points` (the backend omits empty buckets) — rendered as gaps, not fabricated zero bars,
 * so the chart never implies data for a day nothing is known about.
 */
export function AssessmentVolumeChart({ points, ariaLabel }: { points: VolumePoint[]; ariaLabel: string }) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()

  const max = niceMax(Math.max(1, ...points.map((p) => p.count)))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = points.length > 0 ? innerW / points.length : innerW
  const barW = Math.min(18, slot * 0.6)
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH
  const ticks = [0, max / 2, max]
  const activePoint = active !== null ? points[active] : null

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          aria-pressed={view === "table"}
          aria-controls={tableId}
          className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2 py-1 text-xs text-fg-muted hover:bg-panel-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {view === "chart" ? <Table2 size={12} aria-hidden="true" /> : <BarChart3 size={12} aria-hidden="true" />}
          {view === "chart" ? "View as table" : "View as chart"}
        </button>
      </div>

      <div id={tableId}>
        {points.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-subtle">No assessments in this range.</p>
        ) : view === "table" ? (
          <DataTable
            caption={ariaLabel}
            rows={points}
            getRowKey={(p) => p.bucketStart}
            columns={[
              { key: "day", header: "Day", cell: (p) => shortDay(p.bucketStart) },
              { key: "count", header: "Assessments", cell: (p) => p.count, className: "tabular-nums" },
            ]}
          />
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={ariaLabel}
              className="h-auto w-full"
              onMouseLeave={() => setActive(null)}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
                  <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-fg-subtle)">
                    {t}
                  </text>
                </g>
              ))}
              {points.map((p, i) => {
                const cx = PAD.left + slot * i + slot / 2
                const top = y(p.count)
                const isActive = active === i
                return (
                  <g
                    key={p.bucketStart}
                    tabIndex={0}
                    role="group"
                    aria-label={`${shortDay(p.bucketStart)}: ${p.count} assessments`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="outline-none [&:focus-visible>rect.focus]:stroke-accent"
                  >
                    <rect
                      className="focus"
                      x={cx - slot / 2 + 1}
                      y={PAD.top}
                      width={slot - 2}
                      height={innerH}
                      fill={isActive ? "var(--color-panel-hover)" : "transparent"}
                      stroke="transparent"
                      strokeWidth="1.5"
                      rx="3"
                    />
                    <rect
                      x={cx - barW / 2}
                      y={top}
                      width={barW}
                      height={Math.max(y(0) - top, 1)}
                      rx="2"
                      fill="var(--color-accent)"
                      stroke="var(--color-panel)"
                      strokeWidth="2"
                    />
                    {i % 2 === 0 ? (
                      <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-fg-subtle)">
                        {shortDay(p.bucketStart)}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>

            {activePoint ? (
              <div
                role="status"
                className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-control border border-line-strong bg-panel-raised px-3 py-2 text-xs shadow-overlay"
                style={{ left: `clamp(0%, ${((PAD.left + slot * (active ?? 0) + slot / 2) / W) * 100}%, 78%)` }}
              >
                <p className="font-medium text-fg">{shortDay(activePoint.bucketStart)}</p>
                <p className="mt-0.5 font-mono text-fg-muted">{activePoint.count} assessments</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
