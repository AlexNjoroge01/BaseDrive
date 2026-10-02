"use client"

import * as React from "react"
import Link from "next/link"
import { HardDrive, Info, LayoutGrid, List, type LucideIcon } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import { useDropTarget } from "@/components/drive/drag-and-drop"
import { usePrefs } from "@/stores/ui-store"
import { cn } from "@/lib/utils"
import type { Crumb, FolderColor } from "@/lib/types"
import { FOLDER_COLORS } from "@/lib/folder-colors"

function CrumbLink({ crumb, droppable }: { crumb: Crumb; droppable: boolean }) {
  const drop = useDropTarget(
    droppable ? { id: crumb.id, name: crumb.name } : null
  )
  return (
    <Link
      href={crumb.href}
      {...drop.props}
      className={cn(
        "max-w-[180px] truncate rounded-full px-2 py-1 font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink",
        drop.isOver && "bg-brand-tint text-brand ring-2 ring-brand"
      )}
    >
      {crumb.name}
    </Link>
  )
}

/** Breadcrumbs; every segment is a drop target. Long paths collapse the middle. */
export function Breadcrumbs({
  crumbs,
  droppable = true,
}: {
  crumbs: Crumb[]
  droppable?: boolean
}) {
  const collapsed = crumbs.length > 4
  const head = collapsed ? crumbs.slice(0, 1) : crumbs.slice(0, -1)
  const middle = collapsed ? crumbs.slice(1, -2) : []
  const tail = collapsed ? crumbs.slice(-2, -1) : []
  const last = crumbs[crumbs.length - 1]
  // "Shared with me" root isn't a folder you can drop into.
  const canDrop = (c: Crumb) =>
    droppable && !(c.id === null && c.href !== "/drive")

  return (
    <Breadcrumb>
      <BreadcrumbList className="scrollbar-none flex-nowrap gap-1 overflow-x-auto text-[13px] sm:gap-1">
        {head.map((c) => (
          <React.Fragment key={c.href}>
            <BreadcrumbItem className="shrink-0">
              <CrumbLink crumb={c} droppable={canDrop(c)} />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </React.Fragment>
        ))}
        {middle.length > 0 && (
          <>
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Show path"
                    />
                  }
                >
                  <BreadcrumbEllipsis className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {middle.map((c) => (
                    <DropdownMenuItem
                      key={c.href}
                      render={<Link href={c.href} />}
                    >
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        {tail.map((c) => (
          <React.Fragment key={c.href}>
            <BreadcrumbItem className="shrink-0">
              <CrumbLink crumb={c} droppable={canDrop(c)} />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </React.Fragment>
        ))}
        {last && (
          <BreadcrumbItem className="shrink-0">
            <BreadcrumbPage className="max-w-[220px] truncate px-2 font-bold text-ink">
              {last.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function ViewControls({
  showView = true,
  showDetails = true,
}: {
  showView?: boolean
  showDetails?: boolean
}) {
  const view = usePrefs((s) => s.view)
  const setView = usePrefs((s) => s.setView)
  const detailsOpen = usePrefs((s) => s.detailsOpen)
  const toggleDetails = usePrefs((s) => s.toggleDetails)

  return (
    <div className="flex shrink-0 items-center gap-2">
      {showView && (
        // Pill segmented control: --surface track, white thumb.
        <ToggleGroup
          value={[view]}
          onValueChange={(v) => v[0] && setView(v[0] as "list" | "grid")}
          className="hidden h-10 gap-0 rounded-full bg-surface p-1 sm:flex"
          aria-label="View"
        >
          {(
            [
              ["grid", "Grid view", LayoutGrid],
              ["list", "List view", List],
            ] as const
          ).map(([value, label, Icon]) => (
            <Tooltip key={value}>
              <TooltipTrigger
                render={
                  <ToggleGroupItem
                    value={value}
                    aria-label={label}
                    className="h-8 rounded-full px-3 text-ink-muted hover:bg-transparent hover:text-ink data-[pressed]:bg-page data-[pressed]:text-brand data-[pressed]:shadow-[0_1px_3px_rgb(18_26_51/0.12)] dark:data-[pressed]:bg-surface-raised dark:data-[pressed]:text-ink"
                  />
                }
              >
                <Icon className="size-4" />
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      )}
      {showDetails && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="secondary"
                size="icon"
                aria-label="Details"
                aria-pressed={detailsOpen}
                onClick={() => toggleDetails()}
                className={cn(
                  "text-ink-muted hover:text-ink",
                  detailsOpen && "bg-brand-tint text-brand hover:bg-brand-tint hover:text-brand dark:text-[#7fa1ff]"
                )}
              />
            }
          >
            <Info className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent>
            Details <Kbd>I</Kbd>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

export function PageHeader({
  crumbs,
  title,
  icon: Icon = HardDrive,
  color,
  badges,
  showView = true,
  loading,
  droppable,
}: {
  crumbs?: Crumb[]
  title: string
  icon?: LucideIcon
  /** Folder colour for the title badge (subfolders). */
  color?: FolderColor
  badges?: React.ReactNode
  showView?: boolean
  loading?: boolean
  droppable?: boolean
}) {
  const badge = color ? FOLDER_COLORS[color] : null
  return (
    <div className="space-y-3 pt-6 pb-6 sm:pt-8">
      {loading ? (
        <Skeleton className="h-4 w-40" />
      ) : crumbs && crumbs.length > 1 ? (
        <Breadcrumbs crumbs={crumbs} droppable={droppable} />
      ) : null}
      <div className="flex items-center gap-3">
        {loading ? (
          <Skeleton className="h-9 w-56 rounded-xl" />
        ) : (
          <h1 className="text-title min-w-0 truncate">{title}</h1>
        )}
        {!loading && (
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-lg"
            style={{ background: badge?.solid ?? "var(--brand)", color: badge?.on ?? "#fff" }}
          >
            <Icon className="size-4" strokeWidth={2.25} />
          </span>
        )}
        <div className="flex shrink-0 items-center gap-1.5">{badges}</div>
        <div className="ml-auto">
          <ViewControls showView={showView} />
        </div>
      </div>
    </div>
  )
}
