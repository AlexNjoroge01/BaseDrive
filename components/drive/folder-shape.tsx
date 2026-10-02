"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { folderVars } from "@/lib/folder-colors"
export { folderTextClass } from "@/lib/folder-colors"
import type { FolderColor } from "@/lib/types"

/**
 * Folder outline with a raised tab (Design.md §6). The path is built from the
 * measured size so the curves stay round at any width (a stretched viewBox
 * would distort them).
 *   tab: 40% width, 16px tall, 12px top radii, concave join into the body
 *   body: 18px corners
 */
const tabWidth = (w: number) => Math.max(56, Math.min(w * 0.4, 140))

export function folderPath(w: number, h: number, tabH = 16) {
  const tw = tabWidth(w)
  const r = 18
  return [
    `M0 12 Q0 0 12 0`,
    `H${tw - 12}`,
    `Q${tw - 4} 0 ${tw} ${tabH * 0.375}`,
    `L${tw + 4} ${tabH * 0.75}`,
    `Q${tw + 8} ${tabH} ${tw + 16} ${tabH}`,
    `H${w - r}`,
    `Q${w} ${tabH} ${w} ${tabH + r}`,
    `V${h - r}`,
    `Q${w} ${h} ${w - r} ${h}`,
    `H${r}`,
    `Q0 ${h} 0 ${h - r}`,
    `Z`,
  ].join(" ")
}

/** Just the tab plus a sliver of body, painted solid on tinted cards. */
function tabPath(w: number) {
  const tw = tabWidth(w)
  return `M0 12 Q0 0 12 0 H${tw - 12} Q${tw - 4} 0 ${tw} 6 L${tw + 4} 12 Q${tw + 8} 16 ${tw + 16} 16 H12 Q0 16 0 28 Z`
}

/** Measures an element via a callback ref (no ref mutation during render). */
function useSize(initial: { w: number; h: number }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  const [size, setSize] = React.useState(initial)
  React.useLayoutEffect(() => {
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, size] as const
}

export type FolderShapeProps = {
  color?: FolderColor
  /** Solid fill (selected / hovered / featured). Otherwise tint. */
  solid?: boolean
  /** Dashed brand outline (empty states). */
  dashed?: boolean
  /** Fill on hover too (interactive cards). */
  hoverSolid?: boolean
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

export const FolderShape = React.forwardRef<HTMLDivElement, FolderShapeProps & React.HTMLAttributes<HTMLDivElement>>(
  function FolderShape({ color, solid, dashed, hoverSolid, className, style, children, ...rest }, forwarded) {
    const [measure, { w, h }] = useSize({ w: 220, h: 132 })
    const setRefs = React.useCallback(
      (el: HTMLDivElement | null) => {
        measure(el)
        if (typeof forwarded === "function") forwarded(el)
        else if (forwarded) forwarded.current = el
      },
      [measure, forwarded]
    )
    return (
      <div
        ref={setRefs}
        data-solid={solid || undefined}
        style={{ ...folderVars(color), ...style }}
        className={cn("group/folder relative isolate", className)}
        {...rest}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible"
          aria-hidden
        >
          <path
            d={folderPath(w, h)}
            vectorEffect="non-scaling-stroke"
            className={cn(
              "transition-[fill] duration-150 ease-out",
              dashed
                ? "fill-[var(--folder-tint)] stroke-brand [stroke-dasharray:6_6] [stroke-width:2]"
                : solid
                  ? "fill-[var(--folder-solid)]"
                  : "fill-[var(--folder-tint)]",
              hoverSolid && !solid && "group-hover/folder:fill-[var(--folder-solid)]"
            )}
          />
          {/* The tab always carries the solid colour on tinted cards. */}
          {!dashed && (
            <path
              d={tabPath(w)}
              className={cn(
                "fill-[var(--folder-solid)] transition-opacity duration-150",
                solid ? "opacity-0" : "opacity-100",
                hoverSolid && "group-hover/folder:opacity-0"
              )}
            />
          )}
        </svg>
        {children}
      </div>
    )
  }
)
