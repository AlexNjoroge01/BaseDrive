"use client"

import * as React from "react"
import { EllipsisVertical, Star, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ActionItems } from "@/components/drive/item-actions"
import { useCollection } from "@/components/drive/collection-context"
import { useSelection } from "@/stores/selection-store"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

/** Kebab: same items as the right-click menu. */
export function ItemMenuButton({ item, className }: { item: ItemDTO; className?: string }) {
  const { actionsFor } = useCollection()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${item.name}`}
            className={cn("text-ink-muted hover:text-ink", className)}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        }
      >
        <EllipsisVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" onClick={(e) => e.stopPropagation()}>
        <ActionItems actions={actionsFor(item)} as="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Right-click menu around a row or tile. Right-clicking outside the selection selects just that item. */
export function ItemContextMenu({
  item,
  render,
  children,
}: {
  item: ItemDTO
  render: React.ReactElement
  children: React.ReactNode
}) {
  const { actionsFor } = useCollection()
  const ids = useSelection((s) => s.ids)
  const selectOnly = useSelection((s) => s.selectOnly)

  return (
    <ContextMenu
      onOpenChange={(open) => {
        // Actions are computed on render, after the selection settles.
        if (open && !ids.has(item.id)) selectOnly(item.id)
      }}
    >
      <ContextMenuTrigger render={render}>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ActionItems actions={actionsFor(item)} as="context" />
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function ItemBadges({ item }: { item: ItemDTO }) {
  return (
    <>
      {item.shared && (
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex shrink-0 text-ink-faint" />}>
            <Users className="size-3.5" aria-label="Shared" />
          </TooltipTrigger>
          <TooltipContent>Shared</TooltipContent>
        </Tooltip>
      )}
      {item.starred && (
        <Star className="size-3.5 shrink-0 fill-type-folder text-type-folder" aria-label="Starred" />
      )}
    </>
  )
}
