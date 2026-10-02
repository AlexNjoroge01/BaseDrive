"use client"

import { motion } from "framer-motion"
import { Checkbox } from "@/components/ui/checkbox"
import { TypeIcon } from "@/components/drive/type-icon"
import { FileName } from "@/components/drive/file-name"
import { RenameInput } from "@/components/drive/rename-input"
import { ItemBadges, ItemContextMenu, ItemMenuButton } from "@/components/drive/item-parts"
import { useCollection } from "@/components/drive/collection-context"
import { useDraggable, useDropTarget } from "@/components/drive/drag-and-drop"
import { UserAvatar } from "@/components/shell/user-menu"
import { useSelection } from "@/stores/selection-store"
import { useDialogs, usePrefs } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import { firstName, formatBytes, formatFull, formatModified, timeAgo } from "@/lib/format"
import { folderVars } from "@/lib/folder-colors"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ItemDTO } from "@/lib/types"

/**
 * 52px row. Hover is a --surface pill and selection a --brand-tint pill
 * (10px radius); the pill is painted on the cells so the table stays a table.
 */
export function FileRow({ item, viewerId }: { item: ItemDTO; viewerId?: string }) {
  const c = useCollection()
  const compact = usePrefs((s) => s.compact)
  const selected = useSelection((s) => s.ids.has(item.id))
  const anySelected = useSelection((s) => s.ids.size > 0)
  const focused = useSelection((s) => s.focusId === item.id)
  const toggle = useSelection((s) => s.toggle)
  const renaming = useDialogs((s) => s.renameId === item.id)
  const drag = useDraggable(item, c.selectedItems, c.canDrag && !renaming)
  const isFolder = item.type === "FOLDER"
  const drop = useDropTarget(
    isFolder && c.context === "drive" && (item.role === "OWNER" || item.role === "EDITOR")
      ? { id: item.id, name: item.name }
      : null
  )
  const date =
    c.columns.date === "deleted" && item.trashedAt
      ? { label: `Deleted ${timeAgo(item.trashedAt)}`, full: formatFull(item.trashedAt) }
      : { label: formatModified(item.updatedAt), full: formatFull(item.updatedAt) }
  const isMe = viewerId ? item.owner.id === viewerId : item.role === "OWNER"

  return (
    <ItemContextMenu
      item={item}
      render={
        <motion.tr
          layout="position"
          initial={c.isNew(item.id) ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="row"
          aria-selected={selected}
          data-item-id={item.id}
          data-new={c.isNew(item.id) || undefined}
          tabIndex={focused ? 0 : -1}
          onClick={(e) => c.onItemClick(item, e)}
          onDoubleClick={() => !renaming && c.openItem(item)}
          style={isFolder ? folderVars(item.color) : undefined}
          {...drag}
          {...drop.props}
          className={cn(
            "group/row cursor-default outline-none select-none",
            "[&>td]:border-b [&>td]:border-line [&>td]:transition-colors [&:last-child>td]:border-b-0",
            "[&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md",
            "hover:[&>td]:border-transparent hover:[&>td]:bg-surface focus-visible:[&>td]:bg-surface",
            "focus-visible:[&>td:first-child]:shadow-[inset_2px_0_0_var(--focus)]",
            "data-new:[&>td]:animate-[row-flash_900ms_ease-out]",
            selected && "[&>td]:border-transparent [&>td]:bg-brand-tint! ",
            drop.isOver && "[&>td]:border-transparent [&>td]:bg-[var(--folder-tint)]! [&>td:first-child]:shadow-[inset_3px_0_0_var(--folder-solid)]"
          )}
        />
      }
    >
      {c.context !== "public" && (
        <td className="w-10 pl-3" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={() => toggle(item.id)}
            aria-label={`Select ${item.name}`}
            className={cn(
              "opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden",
              (anySelected || selected) && "opacity-100"
            )}
          />
        </td>
      )}
      <td className={cn("pr-3", c.context === "public" && "pl-4", compact ? "h-11" : "h-[52px]")}>
        <div className="flex min-w-0 items-center gap-3">
          <TypeIcon name={item.name} mimeType={item.mimeType} type={item.type} color={item.color} />
          {renaming ? (
            <RenameInput item={item} />
          ) : (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                <FileName
                  name={item.name}
                  isFolder={isFolder}
                  className={cn("text-[14px] font-medium text-ink", isFolder && "font-semibold")}
                />
                <ItemBadges item={item} />
              </span>
              <span className="text-meta tnum text-ink-muted sm:hidden">
                {date.label}
                {item.type === "FILE" && ` · ${formatBytes(item.size)}`}
              </span>
            </div>
          )}
        </div>
      </td>
      {c.columns.location && (
        <td className="hidden w-[220px] max-w-[220px] truncate pr-3 text-meta text-ink-muted lg:table-cell">
          {item.location}
        </td>
      )}
      {c.columns.owner && (
        <td className="hidden w-[140px] pr-3 min-[900px]:table-cell">
          <span className="flex items-center gap-2 text-meta text-ink-muted">
            <UserAvatar user={item.owner} className="size-[22px] text-[9px]" />
            <span className="truncate">{isMe ? "You" : firstName(item.owner.name, item.owner.email)}</span>
          </span>
        </td>
      )}
      <td className="hidden w-[150px] pr-3 text-meta tnum text-ink-muted sm:table-cell">
        <Tooltip>
          <TooltipTrigger delay={600} render={<span />}>
            {date.label}
          </TooltipTrigger>
          <TooltipContent>{date.full}</TooltipContent>
        </Tooltip>
      </td>
      <td className="hidden w-24 pr-3 text-right text-meta tnum text-ink-muted min-[760px]:table-cell">
        {isFolder ? "—" : formatBytes(item.size)}
      </td>
      <td className="w-11 pr-2 text-right">
        {c.context !== "public" ? (
          <ItemMenuButton
            item={item}
            className="opacity-0 group-hover/row:opacity-100 group-focus-visible/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
          />
        ) : null}
      </td>
    </ItemContextMenu>
  )
}
