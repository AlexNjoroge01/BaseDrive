"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Download,
  ExternalLink,
  FolderInput,
  Info,
  Link2,
  Pencil,
  RotateCcw,
  Share2,
  Star,
  StarOff,
  Trash2,
  Eye,
  Palette,
  Pin,
  PinOff,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { ColorSwatches } from "@/components/drive/color-picker"
import { useDialogs, usePrefs } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { useFolderLook, useRestore, useStar, useTrash } from "@/lib/client/queries"
import { api, errorMessage } from "@/lib/client/api"
import type { AccessInfo, FolderColor, ItemDTO } from "@/lib/types"

export type ActionContext = "drive" | "trash"

export type ItemAction = {
  key: string
  label: string
  icon: LucideIcon
  shortcut?: string
  danger?: boolean
  group: number
  run: () => void
  /** Renders a submenu of colour swatches instead of a plain item. */
  swatches?: { current: FolderColor; onPick: (c: FolderColor) => void }
}

const canEdit = (i: ItemDTO) => i.role === "OWNER" || i.role === "EDITOR"
const isOwner = (i: ItemDTO) => i.role === "OWNER"

export function downloadItems(list: ItemDTO[]) {
  list
    .filter((i) => i.type === "FILE")
    .forEach((i, n) => {
      setTimeout(() => {
        const a = document.createElement("a")
        a.href = `/api/items/${i.id}/download`
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, n * 350)
    })
}

export async function copyItemLink(item: ItemDTO) {
  try {
    const info = await api<AccessInfo>(`/api/items/${item.id}/access`)
    if (info.link) {
      await navigator.clipboard.writeText(info.link.url)
      toast.success("Link copied")
      return
    }
    const target =
      item.type === "FOLDER"
        ? `/drive/${item.id}`
        : `/drive/${item.parentId ?? ""}?preview=${item.id}`.replace("/drive/?", "/drive?")
    await navigator.clipboard.writeText(window.location.origin + target)
    toast.success("Link copied", { description: "Only people with access can open it." })
  } catch (err) {
    toast.error(`Couldn't copy the link. ${errorMessage(err)}`)
  }
}

/** Builds the action list for an item (or the current selection, if it's part of one). */
export function useItemActions(context: ActionContext, siblings: ItemDTO[]) {
  const router = useRouter()
  const open = useDialogs((s) => s.open)
  const toggleDetails = usePrefs((s) => s.toggleDetails)
  const selection = useSelection()
  const trash = useTrash()
  const star = useStar()
  const restore = useRestore((res) => res && router.push("/drive"))
  const look = useFolderLook()

  return React.useCallback(
    (item: ItemDTO): ItemAction[] => {
      const selected = selection.ids.has(item.id)
        ? siblings.filter((s) => selection.ids.has(s.id))
        : [item]
      const multi = selected.length > 1
      const ids = selected.map((s) => s.id)

      if (context === "trash") {
        return [
          { key: "restore", label: multi ? `Restore ${selected.length} items` : "Restore", icon: RotateCcw, group: 0, run: () => restore.mutate({ ids }) },
          { key: "delete", label: "Delete forever", icon: Trash2, danger: true, group: 1, run: () => open("deleteIds", ids) },
        ]
      }

      const allEdit = selected.every(canEdit)
      const actions: ItemAction[] = []
      if (!multi) {
        actions.push({
          key: "open",
          label: item.type === "FOLDER" ? "Open" : "Preview",
          icon: item.type === "FOLDER" ? FolderInput : Eye,
          shortcut: "Enter",
          group: 0,
          run: () =>
            item.type === "FOLDER"
              ? router.push(`/drive/${item.id}`)
              : open("preview", { id: item.id, items: siblings.filter((s) => s.type === "FILE") }),
        })
        actions.push({
          key: "tab",
          label: "Open in new tab",
          icon: ExternalLink,
          group: 0,
          run: () =>
            window.open(
              item.type === "FOLDER" ? `/drive/${item.id}` : `/api/items/${item.id}/download?inline=1`,
              "_blank",
              "noopener"
            ),
        })
        if (isOwner(item)) {
          actions.push({ key: "share", label: "Share…", icon: Share2, shortcut: "⌘⇧S", group: 1, run: () => open("shareId", item.id) })
        }
        actions.push({ key: "copy", label: "Copy link", icon: Link2, group: 1, run: () => void copyItemLink(item) })
      }

      if (selected.some((s) => s.type === "FILE")) {
        actions.push({ key: "download", label: "Download", icon: Download, group: 2, run: () => downloadItems(selected) })
      }
      if (!multi && canEdit(item)) {
        actions.push({ key: "rename", label: "Rename", icon: Pencil, shortcut: "F2", group: 2, run: () => open("renameId", item.id) })
      }
      if (allEdit) {
        actions.push({
          key: "move",
          label: "Move to…",
          icon: FolderInput,
          group: 2,
          run: () => open("move", { ids, ownerId: item.owner.id, fromParentId: item.parentId }),
        })
      }
      if (!multi && item.type === "FOLDER" && canEdit(item)) {
        actions.push({
          key: "color",
          label: "Change colour",
          icon: Palette,
          group: 2,
          run: () => {},
          swatches: { current: item.color, onPick: (color) => look.mutate({ id: item.id, color }) },
        })
        actions.push({
          key: "pin",
          label: item.pinned ? "Unpin" : "Pin to top",
          icon: item.pinned ? PinOff : Pin,
          group: 2,
          run: () => look.mutate({ id: item.id, pinned: !item.pinned }),
        })
      }
      if (!multi) {
        actions.push({
          key: "star",
          label: item.starred ? "Remove from Starred" : "Star",
          icon: item.starred ? StarOff : Star,
          group: 2,
          run: () => star.mutate({ id: item.id, starred: !item.starred }),
        })
        actions.push({
          key: "details",
          label: "Details",
          icon: Info,
          shortcut: "I",
          group: 3,
          run: () => {
            selection.selectOnly(item.id)
            toggleDetails(true)
          },
        })
      }
      if (allEdit) {
        actions.push({
          key: "trash",
          label: multi ? `Move ${selected.length} items to trash` : "Move to trash",
          icon: Trash2,
          shortcut: "Del",
          danger: true,
          group: 3,
          run: () => {
            trash.mutate({ ids })
            selection.clear()
          },
        })
      }
      return actions
    },
    [context, siblings, selection, router, open, restore, star, trash, toggleDetails, look]
  )
}

/** Renders actions with either ContextMenu or DropdownMenu primitives. */
export function ActionItems({
  actions,
  as,
}: {
  actions: ItemAction[]
  as: "context" | "dropdown"
}) {
  const Item = as === "context" ? ContextMenuItem : DropdownMenuItem
  const Sep = as === "context" ? ContextMenuSeparator : DropdownMenuSeparator
  const Shortcut = as === "context" ? ContextMenuShortcut : DropdownMenuShortcut
  const Sub = as === "context" ? ContextMenuSub : DropdownMenuSub
  const SubTrigger = as === "context" ? ContextMenuSubTrigger : DropdownMenuSubTrigger
  const SubContent = as === "context" ? ContextMenuSubContent : DropdownMenuSubContent
  return (
    <>
      {actions.map((a, i) => (
        <React.Fragment key={a.key}>
          {i > 0 && actions[i - 1].group !== a.group && <Sep />}
          {a.swatches ? (
            <Sub>
              <SubTrigger>
                <a.icon />
                {a.label}
              </SubTrigger>
              <SubContent className="w-auto p-3">
                <ColorSwatches value={a.swatches.current} onChange={a.swatches.onPick} />
              </SubContent>
            </Sub>
          ) : (
            <Item variant={a.danger ? "destructive" : "default"} onClick={a.run}>
              <a.icon />
              {a.label}
              {a.shortcut && <Shortcut>{a.shortcut}</Shortcut>}
            </Item>
          )}
        </React.Fragment>
      ))}
    </>
  )
}
