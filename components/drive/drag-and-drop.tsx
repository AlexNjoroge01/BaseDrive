"use client"

import * as React from "react"
import { create } from "zustand"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useMove, invalidateDrive } from "@/lib/client/queries"
import { filesFromDataTransfer, uploadWithFolders } from "@/lib/client/folder-upload"
import { FOLDER_COLORS } from "@/lib/folder-colors"
import type { ItemDTO } from "@/lib/types"

const MIME = "application/x-basedrive-items"

type DragState = {
  dragging: { ids: string[]; ownerId: string; fromParentId: string | null; paths?: string[] } | null
  set: (d: DragState["dragging"]) => void
}
export const useDragState = create<DragState>()((set) => ({
  dragging: null,
  set: (dragging) => set({ dragging }),
}))

const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files")
const hasItems = (e: React.DragEvent) => [...e.dataTransfer.types].includes(MIME)

/** Drag ghost: a mini folder card in the first item's colour, with a count badge. */
function makeGhost(first: ItemDTO, count: number) {
  const solid = first.type === "FOLDER" ? FOLDER_COLORS[first.color].solid : "var(--brand)"
  const on = first.type === "FOLDER" ? FOLDER_COLORS[first.color].on : "#fff"
  const el = document.createElement("div")
  el.style.cssText = "position:fixed;top:-1000px;left:-1000px;padding:8px;font:700 13px var(--font-figtree),system-ui;"
  const name = first.name.replace(/[<>&]/g, "")
  el.innerHTML = `
    <div style="position:relative;width:180px;height:72px">
      <svg viewBox="0 0 180 72" width="180" height="72" style="position:absolute;inset:0">
        <path d="M0 10 Q0 0 10 0 H54 Q60 0 63 5 L66 10 Q69 13 75 13 H164 Q180 13 180 29 V58 Q180 72 166 72 H14 Q0 72 0 58 Z" fill="${solid}"/>
      </svg>
      <div style="position:absolute;left:14px;right:14px;bottom:12px;color:${on};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
      ${count > 1 ? `<span style="position:absolute;top:-6px;right:-6px;min-width:24px;height:24px;padding:0 7px;border-radius:12px;background:var(--ink);color:var(--page);font-size:12px;display:grid;place-items:center">${count}</span>` : ""}
    </div>`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 0)
  return el
}

/**
 * Props for a draggable row/tile. Capture-phase handlers because Framer Motion
 * reserves onDragStart/onDragEnd for its own gesture system.
 */
export function useDraggable(item: ItemDTO, getSelected: () => ItemDTO[], enabled: boolean) {
  const set = useDragState((s) => s.set)
  if (!enabled) return {}
  return {
    draggable: true,
    onDragStartCapture: (e: React.DragEvent) => {
      const selected = getSelected()
      const group = selected.some((s) => s.id === item.id) ? selected : [item]
      const ids = group.map((g) => g.id)
      e.dataTransfer.effectAllowed = "move"
      e.dataTransfer.setData(MIME, JSON.stringify(ids))
      e.dataTransfer.setDragImage(makeGhost(item, ids.length), 30, 40)
      set({ ids, ownerId: item.owner.id, fromParentId: item.parentId })
    },
    onDragEndCapture: () => set(null),
  }
}

/**
 * Drop target for a folder (tile, row, breadcrumb, sidebar "My Drive").
 * Internal drags move; files from the desktop upload into that folder.
 */
export function useDropTarget(folder: { id: string | null; name: string; path?: string } | null) {
  const [isOver, setOver] = React.useState(false)
  const depth = React.useRef(0)
  const move = useMove()
  const qc = useQueryClient()

  if (!folder) return { isOver: false, props: {} }

  const canAccept = (e: React.DragEvent) => {
    if (hasFiles(e)) return true
    if (!hasItems(e)) return false
    const d = useDragState.getState().dragging
    if (!d) return false
    if (folder.id && d.ids.includes(folder.id)) return false
    if (d.fromParentId === folder.id) return false
    return true
  }

  return {
    isOver,
    props: {
      onDragEnter: (e: React.DragEvent) => {
        if (!canAccept(e)) return
        e.preventDefault()
        e.stopPropagation()
        depth.current++
        setOver(true)
      },
      onDragOver: (e: React.DragEvent) => {
        if (!canAccept(e)) return
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = hasFiles(e) ? "copy" : "move"
      },
      onDragLeave: (e: React.DragEvent) => {
        e.stopPropagation()
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      },
      onDrop: async (e: React.DragEvent) => {
        if (!canAccept(e)) return
        e.preventDefault()
        e.stopPropagation()
        depth.current = 0
        setOver(false)
        if (hasItems(e)) {
          const d = useDragState.getState().dragging
          useDragState.getState().set(null)
          if (!d) return
          move.mutate({ ids: d.ids, parentId: folder.id, fromParentId: d.fromParentId })
          return
        }
        const files = await filesFromDataTransfer(e.dataTransfer)
        if (!files.length) return toast.error("Nothing to upload in that drop.")
        void uploadWithFolders(files, { parentId: folder.id, parentName: folder.name }, () =>
          invalidateDrive(qc)
        )
      },
    },
  }
}
