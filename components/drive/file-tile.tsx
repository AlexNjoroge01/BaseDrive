"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { TypeIcon } from "@/components/drive/type-icon"
import { FileName } from "@/components/drive/file-name"
import { RenameInput } from "@/components/drive/rename-input"
import { ItemBadges, ItemContextMenu, ItemMenuButton } from "@/components/drive/item-parts"
import { useCollection, useItemUrls } from "@/components/drive/collection-context"
import { useDraggable } from "@/components/drive/drag-and-drop"
import { useSelection } from "@/stores/selection-store"
import { useDialogs } from "@/stores/ui-store"
import { fileKind } from "@/lib/file-types"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

/** Swatch-tinted 4:3 area with the type icon, or the real thumbnail (crossfaded in). */
export function Thumb({ item, className, iconClassName }: { item: ItemDTO; className?: string; iconClassName?: string }) {
  const urls = useItemUrls()
  const [loaded, setLoaded] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const kind = fileKind(item.name, item.mimeType, item.type)
  const showImg = item.hasThumbnail && !failed

  return (
    <div className={cn("relative grid place-items-center overflow-hidden bg-surface", className)}>
      <TypeIcon
        kind={kind}
        name={item.name}
        color={item.color}
        type={item.type}
        className={cn("size-10 transition-opacity duration-150", loaded && "opacity-0", iconClassName)}
      />
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urls.thumb(item.id)}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-150",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  )
}

export function FileTile({ item }: { item: ItemDTO }) {
  const c = useCollection()
  const selected = useSelection((s) => s.ids.has(item.id))
  const focused = useSelection((s) => s.focusId === item.id)
  const renaming = useDialogs((s) => s.renameId === item.id)
  const drag = useDraggable(item, c.selectedItems, c.canDrag && !renaming)

  return (
    <ItemContextMenu
      item={item}
      render={
        <motion.div
          layout="position"
          initial={c.isNew(item.id) ? { opacity: 0, scale: 0.97 } : false}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          role="gridcell"
          aria-selected={selected}
          data-item-id={item.id}
          tabIndex={focused ? 0 : -1}
          onClick={(e) => c.onItemClick(item, e)}
          onDoubleClick={() => !renaming && c.openItem(item)}
          {...drag}
          className={cn(
            "group/tile relative flex cursor-default flex-col overflow-hidden rounded-[14px] bg-surface ring-1 ring-line outline-none select-none ring-inset",
            "focus-visible:ring-2 focus-visible:ring-brand",
            // Ring on an overlay so the thumbnail can't paint over it.
            selected &&
              "border-transparent after:pointer-events-none after:absolute after:inset-0 after:rounded-[14px] after:ring-2 after:ring-brand after:ring-inset"
          )}
        />
      }
    >
      <Thumb item={item} className="aspect-[4/3] w-full" />
      <div
        className={cn(
          "flex h-12 items-center gap-2.5 bg-page pr-1 pl-3 transition-colors group-hover/tile:bg-surface dark:bg-surface-raised",
          selected && "bg-brand-tint!"
        )}
      >
        <TypeIcon name={item.name} mimeType={item.mimeType} className="size-4" />
        {renaming ? (
          <RenameInput item={item} />
        ) : (
          <FileName name={item.name} className="flex-1 text-[13px] font-semibold text-ink" />
        )}
        <ItemBadges item={item} />
        {c.context !== "public" && (
          <ItemMenuButton
            item={item}
            className="opacity-0 group-hover/tile:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
          />
        )}
      </div>
    </ItemContextMenu>
  )
}
