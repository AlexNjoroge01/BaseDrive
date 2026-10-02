"use client"

import * as React from "react"
import { useRename } from "@/lib/client/queries"
import { useDialogs } from "@/stores/ui-store"
import { splitExt } from "@/lib/names"
import { cn } from "@/lib/utils"
import { ApiClientError } from "@/lib/client/api"
import type { ItemDTO } from "@/lib/types"

/** Inline rename: base name selected, extension left alone. Enter saves, Esc cancels. */
export function RenameInput({ item, className }: { item: ItemDTO; className?: string }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const close = useDialogs((s) => s.close)
  const rename = useRename()
  const [value, setValue] = React.useState(item.name)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    const { base } = item.type === "FOLDER" ? { base: item.name } : splitExt(item.name)
    el.setSelectionRange(0, base.length)
  }, [item])

  const submit = () => {
    const name = value.trim()
    if (!name || name === item.name) return close("renameId")
    rename.mutate(
      { id: item.id, name },
      {
        onSuccess: () => close("renameId"),
        onError: (err) =>
          setError(
            err instanceof ApiClientError && err.code === "NAME_CONFLICT"
              ? `A ${item.type === "FOLDER" ? "folder" : "file"} named ${name} already exists here.`
              : err.message
          ),
      }
    )
  }

  return (
    <div className={cn("relative min-w-0 flex-1", className)} onClick={(e) => e.stopPropagation()}>
      <input
        ref={ref}
        value={value}
        aria-label="New name"
        aria-invalid={!!error}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === "Enter") submit()
          if (e.key === "Escape") close("renameId")
        }}
        onBlur={() => !error && submit()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          "h-8 w-full rounded-lg border-2 border-focus bg-page px-2.5 text-[14px] font-medium text-ink outline-none",
          error && "border-danger"
        )}
      />
      {error && (
        <p role="alert" className="absolute top-full left-0 z-10 mt-1 rounded-lg bg-danger px-2 py-1 text-small whitespace-nowrap text-white shadow-float">
          {error}
        </p>
      )}
    </div>
  )
}
