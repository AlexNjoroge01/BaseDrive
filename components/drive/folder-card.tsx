"use client"

import { motion } from "framer-motion"
import { Folder, Pin } from "lucide-react"
import { FolderShape, folderTextClass } from "@/components/drive/folder-shape"
import { FileName } from "@/components/drive/file-name"
import { RenameInput } from "@/components/drive/rename-input"
import { ItemContextMenu, ItemMenuButton } from "@/components/drive/item-parts"
import { useCollection } from "@/components/drive/collection-context"
import { useDraggable, useDropTarget } from "@/components/drive/drag-and-drop"
import { useSelection } from "@/stores/selection-store"
import { useDialogs } from "@/stores/ui-store"
import { formatBytes, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

const MotionShape = motion.create(FolderShape)

/**
 * A folder that *is* a folder: tinted at rest, solid when hovered, selected
 * or targeted by a drop. Same component on the Pinned shelf and in grid view.
 */
export function FolderCard({
  item,
  size = "shelf",
  selectable = true,
}: {
  item: ItemDTO
  size?: "shelf" | "grid"
  /** Shelf cards open on click instead of selecting. */
  selectable?: boolean
}) {
  const c = useCollection()
  const selected = useSelection((s) => selectable && s.ids.has(item.id))
  const focused = useSelection((s) => s.focusId === item.id)
  const renaming = useDialogs((s) => s.renameId === item.id)
  const drag = useDraggable(item, c.selectedItems, c.canDrag && !renaming)
  const drop = useDropTarget(
    c.context === "drive" && (item.role === "OWNER" || item.role === "EDITOR")
      ? { id: item.id, name: item.name }
      : null
  )
  const solid = selected || drop.isOver
  const meta =
    item.fileCount !== undefined
      ? `${pluralize(item.fileCount, "file")}${item.totalSize ? ` · ${formatBytes(item.totalSize)}` : ""}`
      : null

  return (
    <ItemContextMenu
      item={item}
      render={
        <MotionShape
          layout="position"
          initial={c.isNew(item.id) ? { opacity: 0, scale: 0.96 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          color={item.color}
          solid={solid}
          hoverSolid
          role="gridcell"
          aria-selected={selected}
          data-item-id={selectable ? item.id : undefined}
          tabIndex={selectable ? (focused ? 0 : -1) : 0}
          onClick={(e: React.MouseEvent) => (selectable ? c.onItemClick(item, e) : c.openItem(item))}
          onDoubleClick={() => selectable && !renaming && c.openItem(item)}
          onKeyDown={(e: React.KeyboardEvent) => !selectable && e.key === "Enter" && c.openItem(item)}
          {...drag}
          {...drop.props}
          className={cn(
            "cursor-default rounded-2xl outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            size === "shelf" ? "h-[132px] min-w-[200px]" : "h-28 min-w-0"
          )}
        />
      }
    >
      <div className={cn("flex h-full flex-col justify-between px-4 pt-6 pb-3.5", folderTextClass(solid, true))}>
        <div className="flex items-start justify-between">
          <span
            className={cn(
              "grid size-9 place-items-center rounded-xl transition-colors duration-150",
              solid
                ? "bg-white/20 text-[var(--folder-on)]"
                : "bg-page/70 text-[var(--folder-solid)] group-hover/folder:bg-white/20 group-hover/folder:text-[var(--folder-on)] dark:bg-black/15"
            )}
          >
            <Folder className="size-[18px]" fill="currentColor" fillOpacity={0.25} strokeWidth={2} />
          </span>
          <div className="-mt-2 -mr-2 flex items-center">
            {item.pinned && size === "grid" && <Pin className="mr-1 size-3.5 opacity-70" aria-label="Pinned" />}
            {c.context !== "public" && (
              <ItemMenuButton
                item={item}
                className={cn(
                  "text-current opacity-70 hover:bg-black/8 hover:text-current hover:opacity-100 aria-expanded:bg-black/8 dark:hover:bg-white/10",
                  "focus-visible:opacity-100"
                )}
              />
            )}
          </div>
        </div>
        <div className="min-w-0">
          {renaming ? (
            <RenameInput item={item} className="text-ink" />
          ) : (
            <FileName name={item.name} isFolder className="text-[15px] leading-5 font-bold" />
          )}
          {meta && <p className="mt-0.5 truncate text-small font-medium tnum opacity-80">{meta}</p>}
        </div>
      </div>
    </ItemContextMenu>
  )
}
