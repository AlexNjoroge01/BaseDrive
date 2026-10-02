import {
  AudioLines,
  Clapperboard,
  File,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  Image as ImageIcon,
  Presentation,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { KIND_LABEL, fileKind, type FileKind } from "@/lib/file-types"
import { FOLDER_COLORS } from "@/lib/folder-colors"
import type { FolderColor } from "@/lib/types"

export const KIND_ICON: Record<FileKind, LucideIcon> = {
  folder: Folder,
  doc: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  pdf: FileType2,
  image: ImageIcon,
  video: Clapperboard,
  audio: AudioLines,
  archive: FileArchive,
  code: FileCode2,
  other: File,
}

/** Only these types get a coloured badge; the rest stay neutral (Design.md §2). */
export const KIND_BADGE: Partial<Record<FileKind, string>> = {
  pdf: "var(--f-coral)",
  sheet: "var(--f-mint)",
  image: "var(--f-violet)",
  video: "var(--f-coral)",
  slides: "var(--f-sun)",
  doc: "var(--f-blue)",
}

type Props = {
  name: string
  mimeType?: string | null
  type?: "FILE" | "FOLDER"
  kind?: FileKind
  /** Folder colour (folders only). */
  color?: FolderColor
  className?: string
  /** Hide the type badge (e.g. on coloured surfaces). */
  plain?: boolean
}

/**
 * Files: a softly filled neutral glyph with a small coloured type badge.
 * Folders: a filled folder in the folder's own colour, so colour carries
 * from the shelf into the list.
 */
export function TypeIcon({ name, mimeType, type, kind, color, className, plain }: Props) {
  const k = kind ?? fileKind(name, mimeType, type)
  const Icon = KIND_ICON[k]

  if (k === "folder") {
    const c = FOLDER_COLORS[color ?? "blue"].solid
    return (
      <Icon
        role="img"
        aria-label={KIND_LABEL.folder}
        className={cn("size-5 shrink-0", className)}
        style={{ color: c }}
        fill="currentColor"
        fillOpacity={0.9}
        strokeWidth={1.6}
      />
    )
  }

  const badge = plain ? undefined : KIND_BADGE[k]
  return (
    <span
      role="img"
      aria-label={KIND_LABEL[k]}
      className={cn("relative inline-flex size-5 shrink-0 text-ink-muted", className)}
    >
      <Icon className="size-full" fill="currentColor" fillOpacity={0.14} strokeWidth={1.7} aria-hidden />
      {badge && (
        <span
          aria-hidden
          className="absolute -right-0.5 -bottom-0.5 size-[38%] min-h-1.5 min-w-1.5 rounded-full ring-2 ring-page"
          style={{ background: badge }}
        />
      )}
    </span>
  )
}
