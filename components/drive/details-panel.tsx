"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight, Folder, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Thumb } from "@/components/drive/file-tile"
import { UserAvatar } from "@/components/shell/user-menu"
import { useSessionUser } from "@/components/session-context"
import { useAccess, useItem, useRename } from "@/lib/client/queries"
import { usePrefs, useDialogs } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { KIND_LABEL, fileKind } from "@/lib/file-types"
import { formatBytes, formatFull, pluralize } from "@/lib/format"
import { FolderShape } from "@/components/drive/folder-shape"
import { splitExt } from "@/lib/names"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { ItemDTO } from "@/lib/types"

const ROLE_LABEL = { OWNER: "Owner", EDITOR: "Editor", VIEWER: "Viewer" } as const

/** Shows the single selected item, else the folder you're in. */
export function DetailsPanel({ items, folder }: { items: ItemDTO[]; folder: ItemDTO | null }) {
  const open = usePrefs((s) => s.detailsOpen)
  const toggle = usePrefs((s) => s.toggleDetails)
  const ids = useSelection((s) => s.ids)
  const desktop = useMediaQuery("(min-width: 1024px)")
  const selected = ids.size === 1 ? items.find((i) => ids.has(i.id)) : null
  const target = selected ?? folder

  const body = (
    <PanelBody target={target} multi={ids.size > 1 ? ids.size : 0} onClose={() => toggle(false)} />
  )

  if (!desktop) {
    return (
      <Sheet open={open} onOpenChange={(o) => toggle(o)}>
        <SheetContent side="right" className="w-[340px] bg-surface p-0 sm:max-w-[340px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Details</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="details"
          aria-label="Details"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="shrink-0 overflow-hidden pt-4 pr-4"
        >
          <div className="h-full w-[324px] overflow-y-auto rounded-t-3xl bg-surface">{body}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function PanelBody({
  target,
  multi,
  onClose,
}: {
  target: ItemDTO | null
  multi: number
  onClose: () => void
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-16 items-center justify-between pr-3 pl-5">
        <p className="text-[18px] font-bold text-ink">Details</p>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close details" className="text-ink-muted">
          <X className="size-4" />
        </Button>
      </div>
      {multi ? (
        <p className="px-5 text-meta text-ink-muted">{multi} items selected. Select one item to see its details.</p>
      ) : target ? (
        <ItemDetails key={target.id} item={target} />
      ) : (
        <RootDetails />
      )}
    </div>
  )
}

function RootDetails() {
  return (
    <div className="space-y-2 px-5">
      <p className="text-[15px] font-semibold text-ink">My Drive</p>
      <p className="text-meta text-ink-muted">Select a file or folder to see its details, who has access, and where it lives.</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-1.5 text-meta">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-ink tnum">{children}</dd>
    </div>
  )
}

function ItemDetails({ item }: { item: ItemDTO }) {
  const me = useSessionUser()
  const { data: details } = useItem(item.id)
  const { data: access, isLoading: accessLoading } = useAccess(item.id)
  const openDialog = useDialogs((s) => s.open)
  const kind = fileKind(item.name, item.mimeType, item.type)
  const canEdit = item.role === "OWNER" || item.role === "EDITOR"
  const people = access ? [access.owner, ...access.entries.map((e) => e.user)] : []

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="px-5">
        {item.type === "FOLDER" ? (
          <FolderShape color={item.color} solid className="h-40 w-full">
            <div className="flex h-full flex-col justify-end p-5 text-[var(--folder-on)]">
              <Folder className="mb-auto mt-5 size-8" fill="currentColor" fillOpacity={0.25} strokeWidth={2} />
              <p className="text-small font-semibold tnum opacity-80">
                {pluralize(item.fileCount ?? 0, "file")}
                {item.totalSize ? ` · ${formatBytes(item.totalSize)}` : ""}
              </p>
            </div>
          </FolderShape>
        ) : (
          <Thumb item={item} className="aspect-[4/3] w-full rounded-[14px] bg-page dark:bg-surface-raised" iconClassName="size-14" />
        )}
      </div>

      <div className="space-y-1.5 px-5">
        <EditableName item={item} canEdit={canEdit} />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-ink-muted">
            {KIND_LABEL[kind]}
          </Badge>
          {item.role && item.role !== "OWNER" && (
            <Badge variant="outline" className="text-ink-muted">
              You can {item.role === "EDITOR" ? "edit" : "view"}
            </Badge>
          )}
          {item.shared && (
            <Badge variant="outline" className="border-brand/25 bg-brand-tint text-brand">
              Shared
            </Badge>
          )}
        </div>
      </div>

      <Separator className="bg-line" />

      <section className="space-y-3 px-5">
        <p className="text-[15px] font-bold text-ink">Who has access</p>
        {accessLoading ? (
          <div className="flex -space-x-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="size-8 rounded-full ring-2 ring-surface" />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <AvatarGroup>
              {people.slice(0, 4).map((p) => (
                <Tooltip key={p.id}>
                  <TooltipTrigger render={<span />}>
                    <UserAvatar user={p} className="size-8 ring-2 ring-surface" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.id === me.id ? "You" : (p.name ?? p.email)}
                  </TooltipContent>
                </Tooltip>
              ))}
              {people.length > 4 && <AvatarGroupCount className="size-8 text-xs">+{people.length - 4}</AvatarGroupCount>}
            </AvatarGroup>
            <p className="text-meta text-ink-muted">
              {people.length <= 1
                ? "Only you"
                : `${people.length} people${access?.link ? " · link on" : ""}`}
            </p>
          </div>
        )}
        {item.role === "OWNER" && (
          <Button size="sm" onClick={() => openDialog("shareId", item.id)}>
            Manage access
          </Button>
        )}
      </section>

      <Separator className="bg-line" />

      <section className="px-5">
        <p className="mb-1.5 text-[15px] font-bold text-ink">Details</p>
        <dl>
          {item.type === "FILE" && <Row label="Size">{formatBytes(item.size)}</Row>}
          <Row label="Location">
            {details ? (
              <span className="flex flex-wrap items-center gap-0.5">
                {details.breadcrumbs.slice(0, -1).map((c, i, arr) => (
                  <React.Fragment key={c.href}>
                    <Link href={c.href} className="text-brand hover:underline">
                      {c.name}
                    </Link>
                    {i < arr.length - 1 && <ChevronRight className="size-3 text-ink-faint" />}
                  </React.Fragment>
                ))}
              </span>
            ) : (
              <Skeleton className="h-3 w-32" />
            )}
          </Row>
          <Row label="Owner">
            {item.owner.id === me.id ? "You" : (item.owner.name ?? item.owner.email)}
          </Row>
          {item.role && <Row label="Your access">{ROLE_LABEL[item.role]}</Row>}
          <Row label="Modified">{formatFull(item.updatedAt)}</Row>
          <Row label="Created">{formatFull(item.createdAt)}</Row>
          {item.mimeType && item.type === "FILE" && (
            <Row label="Type">
              <span className="font-mono text-[12px] break-all text-ink-muted">{item.mimeType}</span>
            </Row>
          )}
        </dl>
      </section>
    </div>
  )
}

function EditableName({ item, canEdit }: { item: ItemDTO; canEdit: boolean }) {
  const [editing, setEditing] = React.useState(false)
  const [value, setValue] = React.useState(item.name)
  const ref = React.useRef<HTMLInputElement>(null)
  const rename = useRename()

  React.useEffect(() => {
    if (!editing || !ref.current) return
    ref.current.focus()
    const { base } = item.type === "FOLDER" ? { base: item.name } : splitExt(item.name)
    ref.current.setSelectionRange(0, base.length)
  }, [editing, item])

  const save = () => {
    setEditing(false)
    const name = value.trim()
    if (name && name !== item.name) rename.mutate({ id: item.id, name }, { onError: () => setValue(item.name) })
    else setValue(item.name)
  }

  if (editing)
    return (
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") {
            setValue(item.name)
            setEditing(false)
          }
        }}
        aria-label="Name"
        className="h-8 w-full rounded-md border border-brand bg-page px-2 text-[15px] font-semibold text-ink outline-none ring-3 ring-brand/20"
      />
    )

  return (
    <button
      type="button"
      disabled={!canEdit}
      onClick={() => {
        setValue(item.name)
        setEditing(true)
      }}
      className={cn(
        "group/name -mx-2 flex w-[calc(100%+16px)] items-start gap-2 rounded-md px-2 py-1 text-left",
        canEdit && "hover:bg-page dark:hover:bg-surface-raised"
      )}
    >
      <span className="min-w-0 flex-1 text-[18px] leading-6 font-bold break-words text-ink">{item.name}</span>
      {canEdit && <Pencil className="mt-1 size-3.5 shrink-0 text-ink-faint opacity-0 group-hover/name:opacity-100" />}
    </button>
  )
}
