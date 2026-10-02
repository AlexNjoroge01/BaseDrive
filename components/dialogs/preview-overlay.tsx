"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Share2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { TypeIcon } from "@/components/drive/type-icon"
import { privateUrls, publicUrls, type ItemUrls } from "@/components/drive/collection-context"
import { useDialogs, usePrefs } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { previewMode, extensionOf } from "@/lib/file-types"
import { formatBytes } from "@/lib/format"
import { renderMarkdown } from "@/lib/markdown"
import { cn } from "@/lib/utils"
import type { ItemDTO } from "@/lib/types"

const TEXT_LIMIT = 1024 * 1024

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            onClick={onClick}
            className={cn("bg-white/10 text-white hover:bg-white/20 hover:text-white", className)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export function PreviewOverlay() {
  const preview = useDialogs((s) => s.preview)
  const open = useDialogs((s) => s.open)
  const close = useDialogs((s) => s.close)
  const toggleDetails = usePrefs((s) => s.toggleDetails)
  const selectOnly = useSelection((s) => s.selectOnly)

  const items = React.useMemo(() => preview?.items ?? [], [preview])
  const index = items.findIndex((i) => i.id === preview?.id)
  const item = items[index]
  const urls: ItemUrls = preview?.linkToken ? publicUrls(preview.linkToken) : privateUrls

  const step = React.useCallback(
    (d: number) => {
      if (!preview || items.length < 2) return
      const next = items[(index + d + items.length) % items.length]
      open("preview", { ...preview, id: next.id })
    },
    [preview, items, index, open]
  )

  React.useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1)
      if (e.key === "ArrowLeft") step(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [preview, step])

  return (
    <DialogPrimitive.Root open={!!item} onOpenChange={(o) => !o && close("preview")}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[#0D1426]/94 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex flex-col text-white outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          {item && (
            <>
              <header className="flex h-[72px] shrink-0 items-center gap-2 px-4 sm:px-6">
                <IconButton label="Back" onClick={() => close("preview")}>
                  <ArrowLeft className="size-5" />
                </IconButton>
                <TypeIcon name={item.name} mimeType={item.mimeType} className="size-5 text-white/70" />
                <DialogPrimitive.Title className="ml-1 min-w-0 flex-1 truncate text-[16px] font-bold">
                  {item.name}
                </DialogPrimitive.Title>
                {items.length > 1 && (
                  <span className="mr-2 hidden rounded-full bg-white/10 px-3 py-1 text-small text-white/70 tnum sm:block">
                    {index + 1} of {items.length}
                  </span>
                )}
                <IconButton label="Download" onClick={() => (window.location.href = urls.download(item.id))}>
                  <Download className="size-[18px]" />
                </IconButton>
                {!preview?.linkToken && item.role === "OWNER" && (
                  <IconButton label="Share" onClick={() => open("shareId", item.id)}>
                    <Share2 className="size-[18px]" />
                  </IconButton>
                )}
                {!preview?.linkToken && (
                  <IconButton
                    label="Details"
                    className="hidden sm:inline-flex"
                    onClick={() => {
                      selectOnly(item.id)
                      toggleDetails(true)
                      close("preview")
                    }}
                  >
                    <Info className="size-[18px]" />
                  </IconButton>
                )}
                <IconButton label="Close" onClick={() => close("preview")}>
                  <X className="size-5" />
                </IconButton>
              </header>

              <div className="group/stage relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-20">
                <PreviewBody key={item.id} item={item} urls={urls} />
                {items.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous file"
                      onClick={() => step(-1)}
                      className="absolute top-1/2 left-4 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white opacity-0 transition-opacity group-hover/stage:opacity-100 hover:bg-white/20 focus-visible:opacity-100"
                    >
                      <ChevronLeft className="size-6" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next file"
                      onClick={() => step(1)}
                      className="absolute top-1/2 right-4 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white opacity-0 transition-opacity group-hover/stage:opacity-100 hover:bg-white/20 focus-visible:opacity-100"
                    >
                      <ChevronRight className="size-6" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function PreviewBody({ item, urls }: { item: ItemDTO; urls: ItemUrls }) {
  const mode = previewMode(item.name, item.mimeType)
  const src = urls.inline(item.id)

  if (mode === "image") return <ImagePreview src={src} alt={item.name} />
  if (mode === "pdf")
    return <iframe src={src} title={item.name} className="size-full max-w-5xl rounded-3xl bg-white" />
  if (mode === "video")
    return <video src={src} controls autoPlay className="max-h-full max-w-full rounded-3xl bg-black" />
  if (mode === "audio")
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl bg-white/6 p-10">
        <TypeIcon name={item.name} mimeType={item.mimeType} className="size-16 text-white/80" />
        <audio src={src} controls autoPlay className="w-full" />
      </div>
    )
  if (mode === "text" && item.size <= TEXT_LIMIT) return <TextPreview src={src} name={item.name} />

  const ext = extensionOf(item.name)
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="grid size-28 place-items-center rounded-3xl bg-white/8">
        <TypeIcon name={item.name} mimeType={item.mimeType} className="size-14 text-white/80" />
      </div>
      <div>
        <p className="text-[18px] font-bold">
          {mode === "text" ? "This file is too large to preview." : `No preview for ${ext ? `.${ext}` : "this type of"} files`}
        </p>
        <p className="mt-1 text-meta text-white/60 tnum">{formatBytes(item.size)}</p>
      </div>
      <Button onClick={() => (window.location.href = urls.download(item.id))} className="mt-2">
        <Download /> Download
      </Button>
    </div>
  )
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = React.useState(1)
  const [loaded, setLoaded] = React.useState(false)
  return (
    <div
      className="relative flex size-full items-center justify-center overflow-auto"
      onWheel={(e) => setScale((s) => Math.min(6, Math.max(1, s - e.deltaY * 0.0015)))}
      onDoubleClick={() => setScale((s) => (s === 1 ? 2.5 : 1))}
    >
      {!loaded && <Spinner className="absolute size-6 text-white/70" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        style={{ transform: `scale(${scale})` }}
        className={cn(
          "max-h-full max-w-full rounded-2xl object-contain transition-[opacity,transform] duration-150 select-none",
          loaded ? "opacity-100" : "opacity-0",
          scale > 1 ? "cursor-zoom-out" : "cursor-zoom-in"
        )}
        draggable={false}
      />
    </div>
  )
}

function TextPreview({ src, name }: { src: string; name: string }) {
  const [text, setText] = React.useState<string | null>(null)
  const [error, setError] = React.useState(false)
  React.useEffect(() => {
    let alive = true
    fetch(src)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setText(t))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [src])

  const isMd = /\.(md|markdown)$/i.test(name)
  return (
    <div className="size-full max-w-[900px] overflow-auto rounded-3xl bg-page text-ink">
      {error ? (
        <p className="p-8 text-ink-muted">Couldn&apos;t load the preview. Try downloading it instead.</p>
      ) : text === null ? (
        <div className="grid h-40 place-items-center">
          <Spinner className="size-5 text-ink-muted" />
        </div>
      ) : isMd ? (
        <article
          className="prose-basedrive px-10 py-8"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
      ) : (
        <pre className="p-6 font-mono text-[13px] leading-[20px] whitespace-pre-wrap tnum">{text}</pre>
      )}
    </div>
  )
}
