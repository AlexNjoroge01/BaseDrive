import { cn } from "@/lib/utils"
import type { FolderColor } from "@/lib/types"

/** The bright set (Design.md §2). Values are CSS vars so dark mode swaps tints. */
export const FOLDER_COLORS: Record<
  FolderColor,
  { label: string; solid: string; tint: string; on: string }
> = {
  blue: { label: "Blue", solid: "var(--f-blue)", tint: "var(--f-blue-tint)", on: "var(--f-blue-on)" },
  coral: { label: "Coral", solid: "var(--f-coral)", tint: "var(--f-coral-tint)", on: "var(--f-coral-on)" },
  sun: { label: "Sunflower", solid: "var(--f-sun)", tint: "var(--f-sun-tint)", on: "var(--f-sun-on)" },
  mint: { label: "Mint", solid: "var(--f-mint)", tint: "var(--f-mint-tint)", on: "var(--f-mint-on)" },
  violet: { label: "Violet", solid: "var(--f-violet)", tint: "var(--f-violet-tint)", on: "var(--f-violet-on)" },
  aqua: { label: "Aqua", solid: "var(--f-aqua)", tint: "var(--f-aqua-tint)", on: "var(--f-aqua-on)" },
}

export const FOLDER_COLOR_ORDER: FolderColor[] = ["blue", "coral", "sun", "mint", "violet", "aqua"]

/** Inline CSS variables a folder card / icon reads. */
export function folderVars(color: FolderColor | undefined): React.CSSProperties {
  const c = FOLDER_COLORS[color ?? "blue"]
  return {
    "--folder-solid": c.solid,
    "--folder-tint": c.tint,
    "--folder-on": c.on,
  } as React.CSSProperties
}

/** Text colour that matches the card fill (tint → ink, solid → on-solid). */
export const folderTextClass = (solid?: boolean, hoverSolid?: boolean) =>
  cn(
    "transition-colors duration-150",
    solid ? "text-[var(--folder-on)]" : "text-ink",
    hoverSolid && !solid && "group-hover/folder:text-[var(--folder-on)]"
  )
