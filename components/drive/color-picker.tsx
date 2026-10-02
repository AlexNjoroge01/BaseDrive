"use client"

import { Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { FOLDER_COLORS, FOLDER_COLOR_ORDER } from "@/lib/folder-colors"
import { cn } from "@/lib/utils"
import type { FolderColor } from "@/lib/types"

/** Six 28px swatch circles; the selected one gets a 2px ink ring. */
export function ColorSwatches({
  value,
  onChange,
}: {
  value: FolderColor
  onChange: (c: FolderColor) => void
}) {
  return (
    <div role="radiogroup" aria-label="Folder colour" className="flex items-center gap-2">
      {FOLDER_COLOR_ORDER.map((c) => {
        const col = FOLDER_COLORS[c]
        const selected = c === value
        return (
          <Tooltip key={c}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={col.label}
                  onClick={() => onChange(c)}
                  className={cn(
                    "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-popover transition-transform outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    selected && "ring-2 ring-ink"
                  )}
                  style={{ background: col.solid, color: col.on }}
                />
              }
            >
              {selected && <Check className="size-3.5" strokeWidth={3} />}
            </TooltipTrigger>
            <TooltipContent>{col.label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
