"use client"

import * as React from "react"
import Link from "next/link"
import { FolderX, type LucideIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FolderShape } from "@/components/drive/folder-shape"
import { usePrefs } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import type { FolderColor } from "@/lib/types"

/** Only show skeletons if loading takes over 200ms, to avoid a flash. */
export function useDelayedFlag(flag: boolean, delay = 200) {
  const [show, setShow] = React.useState(false)
  React.useEffect(() => {
    if (!flag) return
    const t = setTimeout(() => setShow(true), delay)
    return () => {
      clearTimeout(t)
      setShow(false)
    }
  }, [flag, delay])
  return flag && show
}

const WIDTHS = ["58%", "44%", "66%", "37%", "52%", "41%"]
const pulse = "[animation-duration:1.2s]"

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  const compact = usePrefs((s) => s.compact)
  return (
    <div aria-busy aria-label="Loading" className="space-y-2">
      <div className="flex h-10 items-center justify-between">
        <Skeleton className={cn("h-5 w-16 rounded-full", pulse)} />
        <div className="flex gap-2">
          <Skeleton className={cn("h-9 w-20 rounded-full", pulse)} />
          <Skeleton className={cn("h-9 w-24 rounded-full", pulse)} />
        </div>
      </div>
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={cn("flex items-center gap-3 border-b border-line px-3 last:border-0", compact ? "h-11" : "h-[52px]")}
          >
            <Skeleton className={cn("size-5 rounded-md", pulse)} />
            <Skeleton className={cn("h-3.5 rounded-full", pulse)} style={{ width: WIDTHS[i % WIDTHS.length] }} />
            <Skeleton className={cn("ml-auto hidden h-3 w-20 rounded-full sm:block", pulse)} />
            <Skeleton className={cn("hidden h-3 w-14 rounded-full md:block", pulse)} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function GridSkeleton({ tiles = 8 }: { tiles?: number }) {
  return (
    <div aria-busy aria-label="Loading" className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {Array.from({ length: tiles }).map((_, i) =>
        i < 3 ? (
          <Skeleton key={i} className={cn("h-28 rounded-2xl", pulse)} />
        ) : (
          <div key={i} className="overflow-hidden rounded-[14px] bg-surface">
            <Skeleton className={cn("aspect-[4/3] rounded-none bg-transparent", pulse)} />
            <div className="flex h-12 items-center gap-2 bg-page px-3">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-3 flex-1 rounded-full" />
            </div>
          </div>
        )
      )}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <Empty className={cn("min-h-[44vh] border-0", className)}>
      <EmptyHeader>
        <EmptyMedia className="mb-2">
          <span className="grid size-16 place-items-center rounded-3xl bg-brand-tint text-brand dark:text-[#7fa1ff]">
            <Icon className="size-7" strokeWidth={2} />
          </span>
        </EmptyMedia>
        <EmptyTitle className="text-[18px] font-bold text-ink">{title}</EmptyTitle>
        {description && <EmptyDescription className="text-ink-muted">{description}</EmptyDescription>}
      </EmptyHeader>
      {children && <EmptyContent className="flex-row justify-center gap-2">{children}</EmptyContent>}
    </Empty>
  )
}

/**
 * Empty drive / folder: a large outline folder card (dashed brand stroke,
 * tint fill) holding "Drop files here, or" plus the two actions.
 */
export function DropEmptyState({
  color = "blue",
  small,
  children,
  title = "Drop files here, or",
}: {
  color?: FolderColor
  small?: boolean
  children?: React.ReactNode
  title?: string
}) {
  return (
    <div className="flex justify-center py-6 sm:py-10">
      <FolderShape
        color={color}
        dashed
        className={cn("w-full", small ? "h-56 max-w-[460px]" : "h-72 max-w-[560px]")}
      >
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6 pt-4 text-center">
          <p className={cn("font-extrabold tracking-[-0.01em] text-ink", small ? "text-[18px]" : "text-[22px]")}>
            {title}
          </p>
          {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
        </div>
      </FolderShape>
    </div>
  )
}

export function NotFoundState() {
  return (
    <EmptyState
      icon={FolderX}
      title="This folder doesn't exist or you don't have access."
      description="It may have been moved, deleted, or never shared with you."
    >
      <Button render={<Link href="/drive" />}>Go to My Drive</Button>
    </EmptyState>
  )
}
