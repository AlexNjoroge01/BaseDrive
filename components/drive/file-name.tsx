"use client"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { splitExt } from "@/lib/names"

/**
 * Truncates in the middle so the extension stays visible:
 * "Q3 financial rep…final.xlsx". Full name in a tooltip after 600ms.
 */
export function FileName({
  name,
  className,
  isFolder,
}: {
  name: string
  className?: string
  isFolder?: boolean
}) {
  const { base, ext } = isFolder ? { base: name, ext: "" } : splitExt(name)
  const tail = ext ? Math.min(6, Math.floor(base.length / 3)) : 0
  const head = base.slice(0, base.length - tail)
  const end = base.slice(base.length - tail) + ext

  return (
    <Tooltip>
      <TooltipTrigger
        delay={600}
        render={<span />}
        className={cn("flex min-w-0 items-baseline", className)}
      >
        <span className="truncate">{head}</span>
        <span className="shrink-0 whitespace-pre">{end}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all">{name}</TooltipContent>
    </Tooltip>
  )
}
