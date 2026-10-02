"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  FolderPlus,
  Moon,
  Search,
  Trash2,
  Upload,
  Users,
  Clock,
  Star,
} from "lucide-react"
import { Command as CommandPrimitive } from "cmdk"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { TypeIcon } from "@/components/drive/type-icon"
import { useDialogs } from "@/stores/ui-store"
import { useCurrentFolder } from "@/stores/drive-context"
import { useSearch } from "@/lib/client/queries"
import { KIND_PLURAL, type FileKind } from "@/lib/file-types"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

const CHIPS: FileKind[] = ["folder", "pdf", "image", "sheet", "doc", "video"]

function useDebounced<T>(value: T, ms = 150) {
  const [v, setV] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Match in weight 600, not colour. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="font-bold text-brand dark:text-[#7fa1ff]">
        {text.slice(i, i + q.length)}
      </span>
      {text.slice(i + q.length)}
    </>
  )
}

export function SearchPalette({ onUpload }: { onUpload: () => void }) {
  const open = useDialogs((s) => s.searchOpen)
  const close = useDialogs((s) => s.close)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close("searchOpen")}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] translate-y-0 gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-[640px]"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search files and folders by name.
        </DialogDescription>
        {/* Mounted only while open, so the query resets each time. */}
        <PaletteBody onUpload={onUpload} />
      </DialogContent>
    </Dialog>
  )
}

function PaletteBody({ onUpload }: { onUpload: () => void }) {
  const openDialog = useDialogs((s) => s.open)
  const close = useDialogs((s) => s.close)
  const folder = useCurrentFolder()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [q, setQ] = React.useState("")
  const [kind, setKind] = React.useState<FileKind | null>(null)
  const dq = useDebounced(q.trim())
  const { data, isFetching } = useSearch(dq, kind ?? undefined)

  const results = (dq || kind) && data ? data : []
  const folders = results.filter((r) => r.type === "FOLDER")
  const files = results.filter((r) => r.type === "FILE")

  const go = (fn: () => void) => {
    close("searchOpen")
    fn()
  }
  const openResult = (item: ItemDTO) =>
    go(() =>
      router.push(
        item.type === "FOLDER"
          ? `/drive/${item.id}`
          : `/drive${item.parentId && item.role === "OWNER" ? `/${item.parentId}` : ""}?preview=${item.id}`
      )
    )

  const actions = [
    {
      label: "New folder",
      icon: FolderPlus,
      run: () =>
        folder.canEdit && openDialog("newFolder", { parentId: folder.id }),
    },
    { label: "Upload files", icon: Upload, run: onUpload },
    {
      label: "Go to Shared with me",
      icon: Users,
      run: () => router.push("/shared"),
    },
    { label: "Go to Recent", icon: Clock, run: () => router.push("/recent") },
    { label: "Go to Starred", icon: Star, run: () => router.push("/starred") },
    { label: "Go to Trash", icon: Trash2, run: () => router.push("/trash") },
    {
      label: `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`,
      icon: Moon,
      run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
    },
  ].filter((a) => !dq || a.label.toLowerCase().includes(dq.toLowerCase()))

  const empty =
    (dq || kind) && !isFetching && results.length === 0 && actions.length === 0

  return (
    <CommandPrimitive shouldFilter={false} loop className="flex flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-line px-5">
        {isFetching ? (
          <Spinner className="size-[18px] text-ink-muted" />
        ) : (
          <Search className="size-[18px] text-ink-muted" />
        )}
        <CommandPrimitive.Input
          value={q}
          onValueChange={setQ}
          placeholder="Search your drive"
          className="h-full flex-1 bg-transparent text-[16px] font-medium text-ink outline-none placeholder:text-ink-faint"
        />
        <Kbd>Esc</Kbd>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
        {CHIPS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(kind === k ? null : k)}
            aria-pressed={kind === k}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink",
              kind === k &&
                "bg-brand text-white hover:text-white [&_*]:text-white"
            )}
          >
            <TypeIcon kind={k} name="" className="size-3.5" />
            {KIND_PLURAL[k]}
          </button>
        ))}
      </div>
      <CommandPrimitive.List className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
        {empty && (
          <div className="px-4 py-10 text-center">
            <p className="text-[14px] text-ink">
              No results for &lsquo;{dq || KIND_PLURAL[kind!]}&rsquo;.
            </p>
            <p className="text-meta mt-1 text-ink-muted">
              Search looks at names only.
            </p>
          </div>
        )}
        {folders.length > 0 && (
          <CommandPrimitive.Group heading="Folders" className="cmdk-group">
            {folders.map((r) => (
              <ResultItem
                key={r.id}
                item={r}
                q={dq}
                onSelect={() => openResult(r)}
              />
            ))}
          </CommandPrimitive.Group>
        )}
        {files.length > 0 && (
          <CommandPrimitive.Group heading="Files" className="cmdk-group">
            {files.map((r) => (
              <ResultItem
                key={r.id}
                item={r}
                q={dq}
                onSelect={() => openResult(r)}
              />
            ))}
          </CommandPrimitive.Group>
        )}
        {!kind && actions.length > 0 && (
          <CommandPrimitive.Group heading="Actions" className="cmdk-group">
            {actions.map((a) => (
              <CommandPrimitive.Item
                key={a.label}
                value={`action:${a.label}`}
                onSelect={() => go(a.run)}
                className="flex h-11 cursor-default items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-ink data-[selected=true]:bg-surface"
              >
                <a.icon className="size-[18px] text-ink-muted" />
                {a.label}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        )}
      </CommandPrimitive.List>
    </CommandPrimitive>
  )
}

function ResultItem({
  item,
  q,
  onSelect,
}: {
  item: ItemDTO
  q: string
  onSelect: () => void
}) {
  return (
    <CommandPrimitive.Item
      value={item.id}
      onSelect={onSelect}
      className="flex h-[52px] cursor-default items-center gap-3 rounded-xl px-3 data-[selected=true]:bg-brand-tint"
    >
      <TypeIcon name={item.name} mimeType={item.mimeType} type={item.type} color={item.color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-ink">
          <Highlight text={item.name} q={q} />
        </p>
        {item.location && (
          <p className="text-small truncate font-normal text-ink-faint">
            {item.location}
          </p>
        )}
      </div>
    </CommandPrimitive.Item>
  )
}
