"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  FolderInput,
  RotateCcw,
  Share2,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TypeIcon } from "@/components/drive/type-icon"
import { downloadItems } from "@/components/drive/item-actions"
import { usePrefs, useDialogs, type SortKey } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { useRestore, useTrash } from "@/lib/client/queries"
import { FILTER_KINDS, KIND_PLURAL, type FileKind } from "@/lib/file-types"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

export type DateFilter = "any" | "today" | "week" | "month" | "year"
export type Filters = { kinds: FileKind[]; date: DateFilter }

const DATE_LABEL: Record<DateFilter, string> = {
  any: "Any time",
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  year: "This year",
}

export function matchesDate(iso: string, f: DateFilter) {
  if (f === "any") return true
  const d = new Date(iso)
  const now = new Date()
  if (f === "today") return d.toDateString() === now.toDateString()
  if (f === "week") return now.getTime() - d.getTime() < 7 * 86_400_000
  if (f === "month") return now.getTime() - d.getTime() < 30 * 86_400_000
  return d.getFullYear() === now.getFullYear()
}

const SORT_LABEL: Record<SortKey, string> = {
  name: "Name",
  modified: "Modified",
  size: "Size",
  owner: "Owner",
}

/** Pill chip that opens a menu; filled brand-tint when a filter is active. */
function FilterChip({
  active,
  label,
  children,
}: {
  active: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "gap-1 pr-2.5 pl-3.5 text-[13px] font-semibold",
              active && "bg-brand-tint text-brand hover:bg-brand-tint dark:text-[#7fa1ff]"
            )}
          />
        }
      >
        {label}
        <ChevronDown className="size-3.5 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FilterBar({
  filters,
  onChange,
  showSort = true,
  hideKinds = false,
  className,
}: {
  filters: Filters
  onChange: (f: Filters) => void
  showSort?: boolean
  hideKinds?: boolean
  className?: string
}) {
  const sort = usePrefs((s) => s.sort)
  const setSort = usePrefs((s) => s.setSort)
  const kindLabel =
    filters.kinds.length === 0
      ? "Type"
      : filters.kinds.length === 1
        ? KIND_PLURAL[filters.kinds[0]]
        : `${filters.kinds.length} types`
  const active = filters.kinds.length > 0 || filters.date !== "any"

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      {active && (
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px]"
          onClick={() => onChange({ kinds: [], date: "any" })}
        >
          Clear
        </Button>
      )}
      {!hideKinds && (
        <FilterChip active={filters.kinds.length > 0} label={kindLabel}>
          <DropdownMenuGroup>
            <DropdownMenuLabel>File type</DropdownMenuLabel>
            {FILTER_KINDS.map((k) => (
              <DropdownMenuCheckboxItem
                key={k}
                checked={filters.kinds.includes(k)}
                onCheckedChange={(v) =>
                  onChange({
                    ...filters,
                    kinds: v ? [...filters.kinds, k] : filters.kinds.filter((x) => x !== k),
                  })
                }
              >
                <TypeIcon kind={k} name="" className="size-4" />
                {KIND_PLURAL[k]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          {filters.kinds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onChange({ ...filters, kinds: [] })}>
                <X /> Clear type filter
              </DropdownMenuItem>
            </>
          )}
        </FilterChip>
      )}
      <FilterChip
        active={filters.date !== "any"}
        label={filters.date === "any" ? "Modified" : DATE_LABEL[filters.date]}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>Modified</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.date}
            onValueChange={(v) => onChange({ ...filters, date: v as DateFilter })}
          >
            {(Object.keys(DATE_LABEL) as DateFilter[]).map((d) => (
              <DropdownMenuRadioItem key={d} value={d}>
                {DATE_LABEL[d]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </FilterChip>
      {showSort && (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Sort by ${SORT_LABEL[sort.key]}`}
                    />
                  }
                />
              }
            >
              {sort.dir === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </TooltipTrigger>
            <TooltipContent>Sort: {SORT_LABEL[sort.key]}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={sort.key} onValueChange={(v) => setSort(v as SortKey)}>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                  <DropdownMenuRadioItem key={k} value={k}>
                    {SORT_LABEL[k]}
                    {sort.key === k && (
                      <span className="ml-auto text-ink-faint">{sort.dir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

function BarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[14px] font-semibold text-white transition-colors outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
          />
        }
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
      </TooltipTrigger>
      <TooltipContent className="md:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Floating blue pill that rises from the bottom centre when anything is
 * selected (Design.md §7). The upload dock steps aside while it's up.
 */
export function SelectionBar({
  items,
  context,
}: {
  items: ItemDTO[]
  context: "drive" | "trash"
}) {
  const ids = useSelection((s) => s.ids)
  const clear = useSelection((s) => s.clear)
  const open = useDialogs((s) => s.open)
  const trash = useTrash()
  const restore = useRestore()
  // Portal target only exists on the client.
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  const selected = items.filter((i) => ids.has(i.id))
  const idList = selected.map((s) => s.id)
  const canEdit = selected.length > 0 && selected.every((s) => s.role === "OWNER" || s.role === "EDITOR")
  const single = selected.length === 1 ? selected[0] : null
  const hasFiles = selected.some((s) => s.type === "FILE")

  if (!mounted) return null
  return createPortal(
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.div
          key="selection-bar"
          role="toolbar"
          aria-label="Selection"
          initial={{ opacity: 0, y: 24, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 24, x: "-50%" }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] left-1/2 z-40 flex h-14 max-w-[calc(100vw-24px)] items-center gap-0.5 rounded-full bg-brand pr-2 pl-2 text-white shadow-float sm:bottom-6 dark:shadow-[0_12px_32px_-8px_rgb(0_0_0/0.6)]"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear selection"
                  className="grid size-10 place-items-center rounded-full outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
                />
              }
            >
              <X className="size-[18px]" />
            </TooltipTrigger>
            <TooltipContent>
              Clear selection <kbd className="ml-1 opacity-70">Esc</kbd>
            </TooltipContent>
          </Tooltip>
          <span className="pr-3 pl-1 text-[14px] font-bold whitespace-nowrap tnum" aria-live="polite">
            {selected.length} selected
          </span>
          <span className="mx-1 h-6 w-px bg-white/30" aria-hidden />
          {context === "trash" ? (
            <>
              <BarButton
                icon={<RotateCcw className="size-[18px]" />}
                label="Restore"
                onClick={() => {
                  restore.mutate({ ids: idList })
                  clear()
                }}
              />
              <BarButton
                icon={<Trash2 className="size-[18px]" />}
                label="Delete forever"
                onClick={() => open("deleteIds", idList)}
              />
            </>
          ) : (
            <>
              {single?.role === "OWNER" && (
                <BarButton icon={<Share2 className="size-[18px]" />} label="Share" onClick={() => open("shareId", single.id)} />
              )}
              {canEdit && (
                <BarButton
                  icon={<FolderInput className="size-[18px]" />}
                  label="Move"
                  onClick={() =>
                    open("move", { ids: idList, ownerId: selected[0].owner.id, fromParentId: selected[0].parentId })
                  }
                />
              )}
              {hasFiles && (
                <BarButton icon={<Download className="size-[18px]" />} label="Download" onClick={() => downloadItems(selected)} />
              )}
              {canEdit && (
                <BarButton
                  icon={<Trash2 className="size-[18px]" />}
                  label="Trash"
                  onClick={() => {
                    trash.mutate({ ids: idList })
                    clear()
                  }}
                />
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
