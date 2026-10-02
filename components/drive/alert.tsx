import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

/** Banner (16px radius). Sunflower tint for the Trash notice. */
export function Alert({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode
  className?: string
  tone?: "neutral" | "sun"
}) {
  return (
    <div
      role="note"
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl py-2 pr-2 pl-4 text-[14px] font-medium",
        tone === "sun" ? "bg-f-sun-tint text-ink" : "bg-surface text-ink-muted",
        className
      )}
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          tone === "sun" ? "bg-f-sun text-[#121A33]" : "bg-page text-ink-muted"
        )}
      >
        <Info className="size-4" strokeWidth={2.25} />
      </span>
      {children}
    </div>
  )
}
