"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, CloudOff, RotateCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TypeIcon } from "@/components/drive/type-icon"
import { useUploads, isActive, type UploadEntry } from "@/stores/upload-store"
import {
  cancelUpload,
  resolveConflict,
  retryUpload,
} from "@/lib/client/uploader"
import { useSelection } from "@/stores/selection-store"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Rough ETA from bytes moved since uploads started; sampled once a second. */
function useEta(hasActive: boolean) {
  const [eta, setEta] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!hasActive) return
    const totals = () => {
      const active = useUploads.getState().entries.filter(isActive)
      return {
        loaded: active.reduce((n, e) => n + e.loaded, 0),
        total: active.reduce((n, e) => n + e.size, 0),
      }
    }
    const start = { t: Date.now(), loaded: totals().loaded }
    const id = setInterval(() => {
      const { loaded, total } = totals()
      const secs = (Date.now() - start.t) / 1000
      const rate = (loaded - start.loaded) / Math.max(secs, 0.001)
      if (secs < 2 || rate <= 0) return setEta(null)
      const left = (total - loaded) / rate
      setEta(
        left < 60
          ? "less than a minute left"
          : `${Math.ceil(left / 60)} min left`
      )
    }, 1000)
    return () => {
      clearInterval(id)
      setEta(null)
    }
  }, [hasActive])
  return hasActive ? eta : null
}

export function UploadDock() {
  const entries = useUploads((s) => s.entries)
  const collapsed = useUploads((s) => s.collapsed)
  const setCollapsed = useUploads((s) => s.setCollapsed)
  const clearFinished = useUploads((s) => s.clearFinished)
  const [hovered, setHovered] = React.useState(false)
  // The selection bar takes the bottom; the dock steps up out of its way.
  const selectionUp = useSelection((s) => s.ids.size > 0)

  const visible = entries.filter((e) => e.status !== "canceled")
  const active = visible.filter(isActive)
  const done = visible.filter((e) => e.status === "done")
  const attention = visible.filter(
    (e) => e.status === "error" || e.status === "conflict"
  )
  const paused = visible.some((e) => e.status === "paused")
  const eta = useEta(active.length > 0)

  // Auto-dismiss 6s after everything completes, unless hovered.
  React.useEffect(() => {
    if (!visible.length || active.length || attention.length || hovered) return
    const t = setTimeout(clearFinished, 6000)
    return () => clearTimeout(t)
  }, [visible.length, active.length, attention.length, hovered, clearFinished])

  // Announce progress at 25% steps and on completion.
  const [announce, setAnnounce] = React.useState("")
  const lastStep = React.useRef(-1)
  const totalSize = active.reduce((n, e) => n + e.size, 0)
  const totalLoaded = active.reduce((n, e) => n + e.loaded, 0)
  const step = totalSize ? Math.floor((totalLoaded / totalSize) * 4) : -1
  React.useEffect(() => {
    if (active.length && step !== lastStep.current && step > 0 && step < 4) {
      setAnnounce(`Uploading, ${step * 25}% done`)
    }
    if (!active.length && done.length && lastStep.current !== 4) {
      setAnnounce(`${pluralize(done.length, "upload")} complete`)
      lastStep.current = 4
      return
    }
    lastStep.current = step
  }, [step, active.length, done.length])

  const title = paused
    ? "Paused, waiting for connection"
    : active.length
      ? `Uploading ${pluralize(active.length, "file")}${eta ? ` · ${eta}` : ""}`
      : attention.length
        ? `${pluralize(attention.length, "upload")} need${attention.length === 1 ? "s" : ""} attention`
        : `${pluralize(done.length, "upload")} complete`

  return (
    <>
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
      <AnimatePresence>
        {visible.length > 0 && (
          <motion.section
            aria-label="Uploads"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: selectionUp ? -72 : 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-40 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-xl bg-surface-raised shadow-float sm:right-6 sm:bottom-6"
          >
            <header className="flex h-[52px] items-center gap-2 bg-brand pr-2 pl-4 text-white">
              {paused ? (
                <CloudOff className="size-4" />
              ) : !active.length && !attention.length ? (
                <span className="grid size-5 place-items-center rounded-full bg-white text-brand">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
              ) : null}
              <p className="min-w-0 flex-1 truncate text-[14px] font-bold">
                {title}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={collapsed ? "Expand uploads" : "Collapse uploads"}
                onClick={() => setCollapsed(!collapsed)}
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    collapsed && "rotate-180"
                  )}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close uploads"
                onClick={() => {
                  active.forEach((e) => cancelUpload(e.localId))
                  useUploads.setState({ entries: [] })
                }}
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <X className="size-4" />
              </Button>
            </header>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.ul
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                  className="max-h-72 overflow-y-auto"
                >
                  {visible.map((e) => (
                    <UploadRow key={e.localId} entry={e} />
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

function UploadRow({ entry: e }: { entry: UploadEntry }) {
  const pct = e.size
    ? Math.round((e.loaded / e.size) * 100)
    : e.status === "done"
      ? 100
      : 0

  return (
    <li className="group/up flex min-h-14 items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
      <TypeIcon name={e.name} mimeType={e.mimeType} className="size-[18px]" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-[14px] font-medium text-ink">{e.name}</p>
        {(e.status === "uploading" ||
          e.status === "starting" ||
          e.status === "completing" ||
          e.status === "queued") && (
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface">
              <motion.div
                className="h-full rounded-full bg-brand"
                initial={false}
                animate={{
                  width: `${e.status === "queued" ? 0 : Math.max(2, pct)}%`,
                }}
                transition={{ duration: 0.2 }}
              />
            </div>
            <span className="text-small tnum w-8 text-right text-ink-muted">
              {e.status === "queued" ? "" : `${pct}%`}
            </span>
          </div>
        )}
        {e.status === "paused" && (
          <p className="text-small text-ink-muted">Paused offline at {pct}%</p>
        )}
        {e.status === "error" && (
          <p className="text-small text-danger">
            {e.error}{" "}
            {e.errorCode === "QUOTA_EXCEEDED" && (
              <Link href="/trash" className="underline underline-offset-2">
                Open Trash
              </Link>
            )}
          </p>
        )}
        {e.status === "conflict" && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-small text-ink-muted">
              Already in {e.parentName}.
            </p>
            <Button
              size="xs"
              variant="outline"
              onClick={() => resolveConflict(e.localId, "keepBoth")}
            >
              Keep both
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => resolveConflict(e.localId, "replace")}
            >
              Replace
            </Button>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {e.status === "done" ? (
          <span className="grid size-6 place-items-center rounded-full bg-success/12 text-success" aria-label="Uploaded">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : e.status === "error" &&
          e.errorCode !== "QUOTA_EXCEEDED" &&
          e.errorCode !== "FILE_TOO_LARGE" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => retryUpload(e.localId)}
                  className="gap-1 text-brand"
                />
              }
            >
              <RotateCw className="size-3.5" /> Retry
            </TooltipTrigger>
            <TooltipContent>Resume from where it stopped</TooltipContent>
          </Tooltip>
        ) : null}
        {e.status !== "done" && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Cancel ${e.name}`}
            onClick={() => cancelUpload(e.localId)}
            className="ml-0.5 text-ink-faint opacity-0 group-hover/up:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          >
            <X />
          </Button>
        )}
      </div>
    </li>
  )
}
