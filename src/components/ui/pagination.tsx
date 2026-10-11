import { ChevronLeft, ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface OffsetPaginationProps {
  /** Whether there is a previous page — i.e. offset > 0. */
  hasPrevious: boolean
  /** The backend's own `has_more` — never derived from a total count, because none is returned. */
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  /** e.g. "Showing 1–20". No total/page-count is implied — the backend doesn't return one. */
  rangeLabel: ReactNode
}

/**
 * Prev/next pagination for an endpoint that returns `has_more` instead of a total count
 * (GET /assessments). Deliberately NOT `Pagination` below: that component requires a known
 * `pageCount` and renders "Page X of Y", which would have to be fabricated here.
 */
export function OffsetPagination({ hasPrevious, hasNext, onPrevious, onNext, rangeLabel }: OffsetPaginationProps) {
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-line px-4 py-3"
    >
      <p className="text-[13px] text-fg-muted">{rangeLabel}</p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrevious} disabled={!hasPrevious}>
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasNext}>
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageCount, onPageChange }: PaginationProps) {
  if (pageCount <= 1) return null

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-line px-4 py-3"
    >
      <p className="text-[13px] text-fg-muted">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
