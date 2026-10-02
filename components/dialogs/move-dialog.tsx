"use client"

import * as React from "react"
import { ChevronRight, HardDrive } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TypeIcon } from "@/components/drive/type-icon"
import { useDialogs } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { useFolderTree, useMove, type TreeFolder } from "@/lib/client/queries"
import { useSessionUser } from "@/components/session-context"
import { cn } from "@/lib/utils"
import { pluralize } from "@/lib/format"

type Node = TreeFolder & { children: Node[] }

function buildTree(folders: TreeFolder[]): Node[] {
  const byId = new Map<string, Node>(
    folders.map((f) => [f.id, { ...f, children: [] }])
  )
  const roots: Node[] = []
  for (const n of byId.values()) {
    const parent = n.parentId ? byId.get(n.parentId) : null
    if (parent) parent.children.push(n)
    else roots.push(n)
  }
  return roots
}

type MoveState = NonNullable<ReturnType<typeof useDialogs.getState>["move"]>

export function MoveDialog() {
  const state = useDialogs((s) => s.move)
  // Keyed so each open starts fresh.
  return state ? <MoveBody key={state.ids.join(",")} state={state} /> : null
}

function MoveBody({ state }: { state: MoveState }) {
  const close = useDialogs((s) => s.close)
  const clear = useSelection((s) => s.clear)
  const me = useSessionUser()
  const { data: folders, isLoading } = useFolderTree(state.ownerId)
  const move = useMove()
  const [target, setTarget] = React.useState<string | null | undefined>(
    undefined
  )
  const [toggled, setToggled] = React.useState<Set<string> | null>(null)

  const ownDrive = state.ownerId === me.id
  const byId = React.useMemo(
    () => new Map((folders ?? []).map((f) => [f.id, f])),
    [folders]
  )
  const tree = React.useMemo(() => buildTree(folders ?? []), [folders])
  // Until the user expands/collapses anything, open the path down to the current folder.
  const expanded = React.useMemo(() => {
    if (toggled) return toggled
    const start = state.fromParentId ? byId.get(state.fromParentId) : null
    return new Set(start ? start.path.split("/").filter(Boolean) : [])
  }, [toggled, byId, state.fromParentId])
  const setExpanded = (fn: (s: Set<string>) => Set<string>) =>
    setToggled(fn(new Set(expanded)))

  const movingPaths = state.ids
    .map((id) => byId.get(id)?.path)
    .filter((p): p is string => !!p)
  const blocked = (f: TreeFolder) =>
    movingPaths.some((p) => f.path.startsWith(p))
  const chosen =
    target === undefined ? undefined : target === null ? null : byId.get(target)
  const chosenName = target === null ? "My Drive" : chosen?.name
  const alreadyHere =
    target !== undefined && (target ?? null) === state.fromParentId
  const crumbs =
    target === undefined
      ? []
      : [
          ...(ownDrive
            ? [{ id: null as string | null, name: "My Drive" }]
            : []),
          ...(chosen?.path ?? "")
            .split("/")
            .filter(Boolean)
            .map((id) => ({ id, name: byId.get(id)?.name ?? "…" })),
        ]

  const renderNode = (n: Node, depth: number): React.ReactNode => {
    const isBlocked = blocked(n)
    const isOpen = expanded.has(n.id)
    const row = (
      <div
        role="treeitem"
        aria-selected={target === n.id}
        aria-expanded={n.children.length ? isOpen : undefined}
        aria-disabled={isBlocked}
        tabIndex={isBlocked ? -1 : 0}
        onClick={() => !isBlocked && setTarget(n.id)}
        onDoubleClick={() => setExpanded((s) => new Set(s).add(n.id))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !isBlocked) setTarget(n.id)
          if (e.key === "ArrowRight") setExpanded((s) => new Set(s).add(n.id))
          if (e.key === "ArrowLeft")
            setExpanded((s) => (s.delete(n.id), new Set(s)))
        }}
        style={{ paddingLeft: 8 + depth * 18 }}
        className={cn(
          "flex h-10 cursor-default items-center gap-1.5 rounded-full pr-3 text-[14px] outline-none select-none",
          "hover:bg-page focus-visible:ring-2 dark:hover:bg-surface-raised focus-visible:ring-brand",
          target === n.id && "bg-brand font-semibold text-white hover:bg-brand [&_svg]:text-white!",
          isBlocked && "cursor-not-allowed opacity-45 hover:bg-transparent"
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={isOpen ? "Collapse" : "Expand"}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((s) => {
              const next = new Set(s)
              if (next.has(n.id)) next.delete(n.id)
              else next.add(n.id)
              return next
            })
          }}
          className={cn(
            "grid size-5 place-items-center rounded-sm text-ink-faint hover:bg-ink/8 hover:text-ink",
            !n.children.length && "invisible"
          )}
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              isOpen && "rotate-90"
            )}
          />
        </button>
        <TypeIcon name={n.name} type="FOLDER" color={n.color} className="size-[18px]" />
        <span className="truncate">{n.name}</span>
      </div>
    )
    return (
      <React.Fragment key={n.id}>
        {isBlocked ? (
          <Tooltip>
            <TooltipTrigger render={<div />}>{row}</TooltipTrigger>
            <TooltipContent side="right">
              Can&apos;t move a folder inside itself
            </TooltipContent>
          </Tooltip>
        ) : (
          row
        )}
        {isOpen && n.children.map((c) => renderNode(c, depth + 1))}
      </React.Fragment>
    )
  }

  const submit = () => {
    if (target === undefined) return
    move.mutate({
      ids: state.ids,
      parentId: target,
      fromParentId: state.fromParentId,
    })
    clear()
    close("move")
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close("move")}>
      <DialogContent className="gap-4 sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Move {pluralize(state.ids.length, "item")}</DialogTitle>
          <DialogDescription className="text-meta flex min-h-5 flex-wrap items-center gap-1">
            {crumbs.length === 0
              ? "Choose a folder."
              : crumbs.map((c, i) => (
                  <React.Fragment key={c.id ?? "root"}>
                    {i > 0 && (
                      <ChevronRight className="size-3 text-ink-faint" />
                    )}
                    <span
                      className={
                        i === crumbs.length - 1 ? "font-medium text-ink" : ""
                      }
                    >
                      {c.name}
                    </span>
                  </React.Fragment>
                ))}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-surface">
          <ScrollArea className="h-[320px]">
            <div role="tree" aria-label="Folders" className="p-1.5">
              {ownDrive && (
                <div
                  role="treeitem"
                  aria-selected={target === null}
                  tabIndex={0}
                  onClick={() => setTarget(null)}
                  onKeyDown={(e) => e.key === "Enter" && setTarget(null)}
                  className={cn(
                    "flex h-10 cursor-default items-center gap-2 rounded-full px-3 text-[14px] outline-none hover:bg-page focus-visible:ring-2 dark:hover:bg-surface-raised focus-visible:ring-brand",
                    target === null &&
                      "bg-brand font-semibold text-white hover:bg-brand [&_svg]:text-white!"
                  )}
                >
                  <HardDrive className="size-[18px] text-ink-muted" />
                  My Drive
                </div>
              )}
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex h-9 items-center gap-2 px-2"
                      style={{ paddingLeft: 26 }}
                    >
                      <Skeleton className="size-[18px] rounded-sm" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  ))
                : tree.map((n) => renderNode(n, ownDrive ? 1 : 0))}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close("move")}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={target === undefined || alreadyHere}
          >
            {target === undefined
              ? "Move here"
              : alreadyHere
                ? "Already here"
                : `Move to ${chosenName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
