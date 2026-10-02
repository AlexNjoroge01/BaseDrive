import { cn } from "@/lib/utils"

/** 28px blue rounded square holding a white folder-tab glyph. */
export function LogoMark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="28" height="28" rx="8" className={inverted ? "fill-white" : "fill-brand"} />
      <path
        d="M7 10.5c0-1 .8-1.8 1.8-1.8h3.3c.5 0 1 .2 1.3.6l.9 1h5c1 0 1.8.8 1.8 1.8v6.2c0 1-.8 1.8-1.8 1.8H8.8c-1 0-1.8-.8-1.8-1.8z"
        className={inverted ? "fill-brand" : "fill-white"}
      />
    </svg>
  )
}

export function Wordmark({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark inverted={inverted} />
      <span
        className={cn(
          "text-[20px] leading-none font-extrabold tracking-[-0.02em]",
          inverted ? "text-white" : "text-brand dark:text-ink"
        )}
      >
        BaseDrive
      </span>
    </span>
  )
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-4", className)} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}
