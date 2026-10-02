"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useUsage } from "@/lib/client/queries"
import { formatBytes } from "@/lib/format"
import { KIND_PLURAL, type FileKind } from "@/lib/file-types"
import { cn } from "@/lib/utils"

export function useStorageState() {
  const { data, isLoading } = useUsage()
  const used = data?.used ?? 0
  const quota = data?.quota ?? 1
  const pct = Math.min(1, used / quota)
  const state = pct >= 1 ? "full" : pct > 0.9 ? "almost" : "ok"
  const caption =
    state === "full"
      ? "Storage full"
      : state === "almost"
        ? `Almost full: ${formatBytes(Math.max(0, quota - used))} left`
        : `${formatBytes(used)} of ${formatBytes(quota, 0)} used`
  return { data, isLoading, pct, state, caption }
}

/**
 * Sidebar storage: a 6px white-at-30% track with a solid white fill.
 * Past 90% the fill turns Sunflower, at 100% Coral.
 */
export function StorageMeter({ className }: { className?: string }) {
  const { data, isLoading, pct, state, caption } = useStorageState()

  if (isLoading || !data) {
    return (
      <div className={cn("space-y-2.5", className)}>
        <Skeleton className="h-3.5 w-16 bg-white/20" />
        <Skeleton className="h-1.5 w-full rounded-full bg-white/20" />
        <Skeleton className="h-3 w-32 bg-white/20" />
      </div>
    )
  }

  const breakdown = data.byKind.slice(0, 4)
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[13px] leading-[18px] font-bold text-white">Storage</p>
      <Tooltip>
        <TooltipTrigger render={<div />} className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
          <motion.div
            className={cn(
              "h-full rounded-full",
              state === "full" ? "bg-f-coral" : state === "almost" ? "bg-f-sun" : "bg-white"
            )}
            initial={false}
            animate={{ width: `${Math.max(pct * 100, data.used ? 2 : 0)}%` }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          />
        </TooltipTrigger>
        <TooltipContent side="right" className="flex-col items-start gap-1">
          {breakdown.length ? (
            breakdown.map((b) => (
              <span key={b.kind} className="flex w-36 justify-between gap-4 tnum">
                <span>{KIND_PLURAL[b.kind as FileKind]}</span>
                <span className="opacity-70">{formatBytes(b.bytes)}</span>
              </span>
            ))
          ) : (
            <span>Nothing stored yet</span>
          )}
        </TooltipContent>
      </Tooltip>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-small tnum text-white/80">{caption}</p>
        {state !== "ok" && (
          <Link href="/trash" className="text-small font-bold text-white underline-offset-2 hover:underline">
            Free up
          </Link>
        )}
      </div>
    </div>
  )
}

/** Tablet rail: a white ring around a small percentage. */
export function StorageRing() {
  const { data, pct, state, caption } = useStorageState()
  const r = 16
  const c = 2 * Math.PI * r
  return (
    <Tooltip>
      <TooltipTrigger render={<div />} className="relative grid size-11 place-items-center" aria-label={caption}>
        <svg viewBox="0 0 40 40" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="20" cy="20" r={r} fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="3.5" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            className={state === "full" ? "stroke-f-coral" : state === "almost" ? "stroke-f-sun" : "stroke-white"}
          />
        </svg>
        <span className="text-[10px] font-bold text-white tnum">{data ? Math.round(pct * 100) : 0}%</span>
      </TooltipTrigger>
      <TooltipContent side="right">{caption}</TooltipContent>
    </Tooltip>
  )
}
