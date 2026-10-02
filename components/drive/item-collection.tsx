"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import { ArrowDown, ArrowUp, SearchX } from "lucide-react"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { FolderCard } from "@/components/drive/folder-card"
import { FileRow } from "@/components/drive/file-row"
import { FileTile } from "@/components/drive/file-tile"
import { useItemActions } from "@/components/drive/item-actions"
import {
  CollectionContext,
  type CollectionApi,
  type CollectionColumns,
} from "@/components/drive/collection-context"
import { FilterBar, SelectionBar, matchesDate, type Filters } from "@/components/drive/toolbar"
import { EmptyState, GridSkeleton, ListSkeleton, useDelayedFlag } from "@/components/drive/states"
import { useSelection } from "@/stores/selection-store"
import { useDialogs, usePrefs, type SortKey } from "@/stores/ui-store"
import { useTrash } from "@/lib/client/queries"
import { useIsMobile } from "@/hooks/use-mobile"
import { fileKind } from "@/lib/file-types"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

type Props = {
  items: ItemDTO[] | undefined
  isLoading: boolean
  context: "drive" | "trash" | "public"
  columns?: CollectionColumns
  /** Section heading shown with the filters ("Files"). */
  heading?: string
  /** Deprecated: folders now live in the table (list) or as cards (grid). */
  folderSection?: boolean
  empty: React.ReactNode
  viewerId?: string
  onOpenFolder?: (item: ItemDTO) => void
  /** Preview handler override (public pages). */
  onPreview?: (item: ItemDTO, siblings: ItemDTO[]) => void
  showFilters?: boolean
}

function compare(key: SortKey, dir: "asc" | "desc") {
  const sign = dir === "asc" ? 1 : -1
  return (a: ItemDTO, b: ItemDTO) => {
    let r = 0
    if (key === "name") r = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    if (key === "modified") r = a.updatedAt.localeCompare(b.updatedAt)
    if (key === "size") r = a.size - b.size
    if (key === "owner")
      r = (a.owner.name ?? a.owner.email).localeCompare(b.owner.name ?? b.owner.email)
    if (r === 0 && key !== "name") r = a.name.localeCompare(b.name, undefined, { numeric: true })
    return r * sign
  }
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))

export function ItemCollection({
  items,
  isLoading,
  context,
  columns = {},
  heading,
  empty,
  viewerId,
  onOpenFolder,
  onPreview,
  showFilters = true,
}: Props) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const prefs = usePrefs()
  const view = isMobile ? "list" : prefs.view
  const selection = useSelection()
  const dialogs = useDialogs()
  const trash = useTrash()
  const [filters, setFilters] = React.useState<Filters>({ kinds: [], date: "any" })
  const showSkeleton = useDelayedFlag(isLoading)

  /* filter + sort: folders before files, always */
  const visible = React.useMemo(() => {
    const list = (items ?? []).filter(
      (i) =>
        (filters.kinds.length === 0 ||
          filters.kinds.includes(fileKind(i.name, i.mimeType, i.type))) &&
        matchesDate(i.updatedAt, filters.date)
    )
    const cmp = compare(prefs.sort.key, prefs.sort.dir)
    const folders = list.filter((i) => i.type === "FOLDER").sort(cmp)
    const files = list.filter((i) => i.type === "FILE").sort(cmp)
    return { folders, files, all: [...folders, ...files] }
  }, [items, filters, prefs.sort])

  const order = React.useMemo(() => visible.all.map((i) => i.id), [visible])

  /* new-item flash: anything that appears after the first load */
  const seen = React.useRef<Set<string> | null>(null)
  const fresh = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (!items) return
    if (!seen.current) {
      seen.current = new Set(items.map((i) => i.id))
      return
    }
    for (const i of items) {
      if (!seen.current.has(i.id)) {
        fresh.current.add(i.id)
        seen.current.add(i.id)
      }
    }
  }, [items])

  const buildActions = useItemActions(context === "trash" ? "trash" : "drive", visible.all)

  const openItem = React.useCallback(
    (item: ItemDTO) => {
      if (context === "trash") {
        toast("Restore this item to open it.")
        return
      }
      if (item.type === "FOLDER") {
        if (onOpenFolder) onOpenFolder(item)
        else router.push(`/drive/${item.id}`)
        return
      }
      const siblings = visible.files
      if (onPreview) onPreview(item, siblings)
      else dialogs.open("preview", { id: item.id, items: siblings })
    },
    [context, onOpenFolder, onPreview, router, visible.files, dialogs]
  )

  const onItemClick = React.useCallback(
    (item: ItemDTO, e: React.MouseEvent) => {
      // Touch: a tap opens, unless we're already in selection mode.
      const coarse = window.matchMedia("(pointer: coarse)").matches
      if (coarse && selection.ids.size === 0 && !e.shiftKey) return openItem(item)
      if (e.shiftKey) selection.selectRange(item.id, order)
      else if (e.metaKey || e.ctrlKey || (coarse && selection.ids.size > 0)) selection.toggle(item.id)
      else selection.selectOnly(item.id)
    },
    [selection, order, openItem]
  )

  const api: CollectionApi = {
    context,
    items: visible.all,
    order,
    actionsFor: context === "public" ? () => [] : buildActions,
    openItem,
    onItemClick,
    selectedItems: () => visible.all.filter((i) => useSelection.getState().ids.has(i.id)),
    isNew: (id) => fresh.current.has(id),
    canDrag: context === "drive" && !isMobile,
    columns: { date: "modified", ...columns },
  }

  /* keyboard: arrows move, Space selects, Enter opens, F2, Del, Esc, ⌘A */
  const rootRef = React.useRef<HTMLDivElement>(null)
  const focusItem = (id: string) => {
    selection.setFocus(id)
    requestAnimationFrame(() =>
      rootRef.current?.querySelector<HTMLElement>(`[data-item-id="${id}"]`)?.focus()
    )
  }
  const moveFocus = (dir: "up" | "down" | "left" | "right") => {
    const current = selection.focusId && order.includes(selection.focusId) ? selection.focusId : null
    if (!current) return order[0]
    const idx = order.indexOf(current)
    if (dir === "left") return order[Math.max(0, idx - 1)]
    if (dir === "right") return order[Math.min(order.length - 1, idx + 1)]
    // 2D: nearest element in the next/previous visual row.
    const els = order.map((id) => rootRef.current?.querySelector<HTMLElement>(`[data-item-id="${id}"]`))
    const me = els[idx]?.getBoundingClientRect()
    if (!me) return current
    let best: { id: string; score: number } | null = null
    els.forEach((el, i) => {
      if (!el || i === idx) return
      const r = el.getBoundingClientRect()
      const dy = r.top - me.top
      if (dir === "down" ? dy <= 4 : dy >= -4) return
      const score = Math.abs(dy) * 1000 + Math.abs(r.left - me.left)
      if (!best || score < best.score) best = { id: order[i], score }
    })
    return (best as { id: string } | null)?.id ?? current
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isTyping(e.target) || dialogs.renameId) return
    const focused = visible.all.find((i) => i.id === selection.focusId)
    const mod = e.metaKey || e.ctrlKey
    const arrows: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    }
    if (arrows[e.key]) {
      e.preventDefault()
      const next = moveFocus(arrows[e.key])
      if (!next) return
      if (e.shiftKey) selection.selectRange(next, order)
      focusItem(next)
      return
    }
    if (e.key === " " && focused) {
      e.preventDefault()
      selection.toggle(focused.id)
    } else if (e.key === "Enter" && focused) {
      e.preventDefault()
      openItem(focused)
    } else if (e.key === "F2" && focused && context === "drive") {
      e.preventDefault()
      if (focused.role === "OWNER" || focused.role === "EDITOR") dialogs.open("renameId", focused.id)
    } else if ((e.key === "Delete" || (e.key === "Backspace" && mod)) && context === "drive") {
      const targets = visible.all.filter(
        (i) => selection.ids.has(i.id) && (i.role === "OWNER" || i.role === "EDITOR")
      )
      if (targets.length) {
        e.preventDefault()
        trash.mutate({ ids: targets.map((t) => t.id) })
        selection.clear()
      }
    } else if (e.key === "Delete" && context === "trash" && selection.ids.size) {
      dialogs.open("deleteIds", [...selection.ids])
    } else if (e.key === "Escape") {
      selection.clear()
    } else if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault()
      selection.setMany(order)
    }
  }

  /* marquee: drag on empty space draws a selection rectangle */
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType !== "mouse" || context === "public") return
    const target = e.target as HTMLElement
    if (target.closest("[data-item-id],button,a,input,[role=menu],thead")) return
    const start = { x: e.clientX, y: e.clientY }
    const additive = e.metaKey || e.ctrlKey || e.shiftKey
    const base = additive ? new Set(selection.ids) : new Set<string>()
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const w = ev.clientX - start.x
      const h = ev.clientY - start.y
      if (!moved && Math.hypot(w, h) < 5) return
      moved = true
      const rect = {
        x: Math.min(start.x, ev.clientX),
        y: Math.min(start.y, ev.clientY),
        w: Math.abs(w),
        h: Math.abs(h),
      }
      setMarquee(rect)
      const hit = new Set(base)
      rootRef.current?.querySelectorAll<HTMLElement>("[data-item-id]").forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.right > rect.x && r.left < rect.x + rect.w && r.bottom > rect.y && r.top < rect.y + rect.h)
          hit.add(el.dataset.itemId!)
      })
      selection.setMany([...hit])
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      setMarquee(null)
      if (!moved && !additive) selection.clear()
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  /* render */
  if (isLoading) {
    if (!showSkeleton) return <div className="min-h-[40vh]" />
    return view === "grid" ? <GridSkeleton /> : <ListSkeleton />
  }

  const hasAny = (items?.length ?? 0) > 0
  const filteredOut = hasAny && visible.all.length === 0

  return (
    <CollectionContext.Provider value={api}>
      <div
        ref={rootRef}
        role="grid"
        aria-multiselectable
        aria-label="Files and folders"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onFocus={(e) => {
          if (e.target === rootRef.current && order[0] && !selection.focusId) focusItem(order[0])
        }}
        tabIndex={selection.focusId ? -1 : 0}
        className="relative flex min-h-[50vh] flex-1 flex-col gap-5 pb-24 outline-none"
      >
        {(heading || (showFilters && context !== "public" && hasAny)) && (
          <div className="flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2">
            {heading && <h2 className="text-section mr-auto">{heading}</h2>}
            {showFilters && context !== "public" && hasAny && (
              <FilterBar filters={filters} onChange={setFilters} className={heading ? "" : "flex-1"} />
            )}
          </div>
        )}

        {!hasAny && empty}
        {filteredOut && (
          <EmptyState icon={SearchX} title="Nothing matches these filters.">
            <Button variant="secondary" onClick={() => setFilters({ kinds: [], date: "any" })}>
              Clear filters
            </Button>
          </EmptyState>
        )}

        {visible.all.length > 0 &&
          (view === "grid" ? (
            <div className="space-y-6">
              {visible.folders.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  <AnimatePresence initial={false}>
                    {visible.folders.map((f) =>
                      context === "trash" ? (
                        <FileTile key={f.id} item={f} />
                      ) : (
                        <FolderCard key={f.id} item={f} size="grid" />
                      )
                    )}
                  </AnimatePresence>
                </div>
              )}
              {visible.files.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                  <AnimatePresence initial={false}>
                    {visible.files.map((f) => (
                      <FileTile key={f.id} item={f} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : (
            <FileTable rows={visible.all} columns={api.columns} viewerId={viewerId} context={context} />
          ))}

        {context !== "public" && <SelectionBar items={visible.all} context={context} />}

        {marquee && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-40 rounded-sm border border-brand bg-brand/10"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
          />
        )}
      </div>
    </CollectionContext.Provider>
  )
}

function SortHeader({
  label,
  sortKey,
  className,
  align = "left",
}: {
  label: string
  sortKey: SortKey
  className?: string
  align?: "left" | "right"
}) {
  const sort = usePrefs((s) => s.sort)
  const setSort = usePrefs((s) => s.setSort)
  const active = sort.key === sortKey
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-11 pr-3 font-normal", className)}
    >
      <button
        type="button"
        onClick={() => setSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-[13px] font-bold text-ink hover:text-brand",
          active && "text-ink",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        {active &&
          (sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />)}
      </button>
    </th>
  )
}

function FileTable({
  rows,
  columns,
  viewerId,
  context,
}: {
  rows: ItemDTO[]
  columns: CollectionColumns
  viewerId?: string
  context: "drive" | "trash" | "public"
}) {
  const ids = useSelection((s) => s.ids)
  const setMany = useSelection((s) => s.setMany)
  const clear = useSelection((s) => s.clear)
  const all = rows.length > 0 && rows.every((r) => ids.has(r.id))
  const some = rows.some((r) => ids.has(r.id))

  return (
    <div className="-mx-1 px-1">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left">
        <thead className="[&_th]:border-b [&_th]:border-line">
          <tr>
            {context !== "public" && (
              <th className="w-10 pl-3" scope="col">
                <Checkbox
                  checked={all}
                  indeterminate={some && !all}
                  onCheckedChange={(v) => (v ? setMany(rows.map((r) => r.id)) : clear())}
                  aria-label="Select all"
                  className="pointer-coarse:hidden"
                />
              </th>
            )}
            <SortHeader label="Name" sortKey="name" className={context === "public" ? "pl-4" : ""} />
            {columns.location && (
              <th scope="col" className="hidden w-[220px] pr-3 text-[13px] font-bold text-ink lg:table-cell">
                Location
              </th>
            )}
            {columns.owner && <SortHeader label="Owner" sortKey="owner" className="hidden w-[140px] min-[900px]:table-cell" />}
            <SortHeader
              label={columns.date === "deleted" ? "Deleted" : "Modified"}
              sortKey="modified"
              className="hidden w-[150px] sm:table-cell"
            />
            <SortHeader label="Size" sortKey="size" align="right" className="hidden w-24 text-right min-[760px]:table-cell" />
            <th className="w-11" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <FileRow key={r.id} item={r} viewerId={viewerId} />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  )
}
