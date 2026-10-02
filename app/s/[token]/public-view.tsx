"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, FolderOpen, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ItemCollection } from "@/components/drive/item-collection"
import { ItemUrlsContext, publicUrls } from "@/components/drive/collection-context"
import { Breadcrumbs, ViewControls } from "@/components/drive/page-header"
import { EmptyState } from "@/components/drive/states"
import { Thumb } from "@/components/drive/file-tile"
import { PreviewOverlay } from "@/components/dialogs/preview-overlay"
import { useDialogs } from "@/stores/ui-store"
import { KIND_LABEL, fileKind, previewMode } from "@/lib/file-types"
import { formatBytes, formatFull } from "@/lib/format"
import type { Crumb, ItemDTO } from "@/lib/types"

export function PublicView({
  token,
  file,
  folder,
}: {
  token: string
  file?: ItemDTO
  folder?: { name: string; crumbs: Crumb[]; items: ItemDTO[] }
}) {
  const router = useRouter()
  const open = useDialogs((s) => s.open)
  const urls = React.useMemo(() => publicUrls(token), [token])

  const preview = (item: ItemDTO, siblings: ItemDTO[]) =>
    open("preview", { id: item.id, items: siblings, linkToken: token })

  return (
    <ItemUrlsContext.Provider value={urls}>
      {file ? (
        <div className="grid flex-1 place-items-center px-6 py-12">
          <div className="w-full max-w-[520px] space-y-6">
            <button
              type="button"
              onClick={() => preview(file, [file])}
              className="block w-full overflow-hidden rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Thumb item={file} className="aspect-[4/3] w-full" iconClassName="size-16" />
            </button>
            <div className="space-y-2">
              <p className="text-[22px] leading-7 font-extrabold break-words text-ink">{file.name}</p>
              <div className="flex flex-wrap items-center gap-2 text-meta text-ink-muted tnum">
                <Badge variant="secondary">{KIND_LABEL[fileKind(file.name, file.mimeType)]}</Badge>
                {formatBytes(file.size)} · Updated {formatFull(file.updatedAt)}
              </div>
            </div>
            <div className="flex gap-2">
              {previewMode(file.name, file.mimeType) !== "none" && (
                <Button variant="secondary" onClick={() => preview(file, [file])}>
                  <Eye /> Preview
                </Button>
              )}
              <Button render={<a href={urls.download(file.id)} />}>
                <Download /> Download
              </Button>
            </div>
          </div>
        </div>
      ) : folder ? (
        <div className="flex-1 px-4 sm:px-10">
          <div className="flex max-w-[1240px] items-center gap-3 pt-6 pb-5">
            <div className="min-w-0 flex-1">
              {folder.crumbs.length > 1 ? (
                <Breadcrumbs crumbs={folder.crumbs} droppable={false} />
              ) : (
                <Badge variant="secondary" className="text-ink-muted">
                  View only
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div>
                <ViewControls showDetails={false} />
              </div>
            </div>
          </div>
          <div className="max-w-[1240px]">
            <ItemCollection
              items={folder.items}
              isLoading={false}
              context="public"
              showFilters={false}
              onOpenFolder={(f) => router.push(`/s/${token}?f=${f.id}`)}
              onPreview={preview}
              empty={<EmptyState icon={FolderOpen} title="This folder is empty." />}
            />
          </div>
        </div>
      ) : null}
      <PreviewOverlay />
    </ItemUrlsContext.Provider>
  )
}

