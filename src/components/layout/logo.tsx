import { cn } from "@/lib/utils"

/**
 * Original FraudDetect mark: a shield (protection) carrying a signal trace (detection).
 * Drawn for this product; not derived from BrandSecOps or any third-party asset.
 */
export function FraudDetectMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d="M16 2.5 26.5 6.4V15c0 6.3-4.4 11.3-10.5 14C9.9 26.3 5.5 21.3 5.5 15V6.4L16 2.5Z"
        fill="var(--color-accent-soft)"
        stroke="var(--color-accent)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 16.2h3.4l2.2-5 2.9 9.2 1.9-4.2h2.6"
        stroke="var(--color-accent)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface LogoProps {
  className?: string
  /** Show the BrandSecOps parent line above the product name. Default true. */
  showParent?: boolean
}

/**
 * BrandSecOps (parent platform) → FraudDetect (this product). The parent is a quiet,
 * tracked-out wordmark; the product name carries the weight, so it reads as a sibling
 * product inside the ecosystem rather than an unrelated brand.
 */
export function Logo({ className, showParent = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <FraudDetectMark />
      <span className="flex flex-col leading-none">
        {showParent ? (
          <span className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">BrandSecOps</span>
        ) : null}
        <span className="text-[15px] font-semibold tracking-tight text-fg">FraudDetect</span>
      </span>
    </span>
  )
}
