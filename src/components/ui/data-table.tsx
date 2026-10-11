import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Extra classes applied to both the header and body cell (widths, alignment, nowrap). */
  className?: string
  /** Header is visually hidden (e.g. an actions column); still announced by screen readers. */
  srOnlyHeader?: boolean
  /**
   * Lower-priority column: dropped at tablet width (md–lg) where the table would otherwise
   * overflow, but shown on desktop and in the stacked phone layout.
   */
  secondary?: boolean
}

interface DataTableProps<T> {
  /** Accessible name for the table. */
  caption: string
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T) => string
  className?: string
}

/**
 * One DOM, two layouts. From `md` up it is a normal dense table; below `md`
 * each row becomes a stacked card whose cells are prefixed with their column
 * header (via `data-label`), so nothing scrolls horizontally on a phone and no
 * text is duplicated in the DOM. Explicit ARIA roles keep table semantics when
 * the display type is overridden by CSS.
 */
export function DataTable<T>({ caption, columns, rows, getRowKey, className }: DataTableProps<T>) {
  return (
    <div className={cn("overflow-x-auto rounded-panel border border-line bg-panel", className)}>
      <table role="table" className="w-full text-left text-[13px] max-md:block">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup" className="max-md:sr-only">
          <tr role="row" className="border-b border-line bg-panel-raised/60 text-[11px] uppercase tracking-wider text-fg-subtle">
            {columns.map((column) => (
              <th
                key={column.key}
                role="columnheader"
                scope="col"
                className={cn("px-4 py-2.5 font-medium", column.secondary && "md:max-lg:hidden", column.className)}
              >
                {column.srOnlyHeader ? <span className="sr-only">{column.header}</span> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="divide-y divide-line max-md:block">
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              role="row"
              className="transition-colors hover:bg-panel-hover/70 max-md:block max-md:px-4 max-md:py-3"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  role="cell"
                  data-label={column.srOnlyHeader ? undefined : column.header}
                  className={cn(
                    "px-4 py-3 align-middle",
                    column.secondary && "md:max-lg:hidden",
                    "max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:px-0 max-md:py-1",
                    "max-md:before:shrink-0 max-md:before:text-[11px] max-md:before:uppercase max-md:before:tracking-wider max-md:before:text-fg-subtle max-md:before:content-[attr(data-label)]",
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
