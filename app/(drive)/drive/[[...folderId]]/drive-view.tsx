"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Folder, FolderPlus, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ItemCollection } from "@/components/drive/item-collection"
import { DetailsPanel } from "@/components/drive/details-panel"
import { PageHeader } from "@/components/drive/page-header"
import { DropEmptyState, NotFoundState } from "@/components/drive/states"
import { PinnedShelf } from "@/components/drive/pinned-shelf"
import { DropZone } from "@/components/upload/drop-zone"
import { useUploadPickers } from "@/components/shell/new-menu"
import { useSessionUser } from "@/components/session-context"
import { useFolder } from "@/lib/client/queries"
import { useCurrentFolder } from "@/stores/drive-context"
import { useDialogs } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { ApiClientError } from "@/lib/client/api"

export function DriveView({ folderId }: { folderId: string | null }) {
  const me = useSessionUser()
  const router = useRouter()
  const params = useSearchParams()
  const { data, isLoading, error } = useFolder(folderId)
  const setCurrent = useCurrentFolder((s) => s.set)
  const clearSelection = useSelection((s) => s.clear)
  const openDialog = useDialogs((s) => s.open)
  const { inputs, pickFiles } = useUploadPickers()

  const folderName = data?.folder?.name ?? "My Drive"
  const canEdit = !data || data.role === "OWNER" || data.role === "EDITOR"

  React.useEffect(() => {
    clearSelection()
  }, [folderId, clearSelection])

  React.useEffect(() => {
    setCurrent({ id: folderId, name: folderName, canEdit })
    document.title = `${folderName} · BaseDrive`
  }, [folderId, folderName, canEdit, setCurrent])

  // Deep link from search / copied links: ?preview=<fileId>
  const previewId = params.get("preview")
  React.useEffect(() => {
    if (!previewId || !data) return
    const files = data.items.filter((i) => i.type === "FILE")
    if (files.some((f) => f.id === previewId)) {
      openDialog("preview", { id: previewId, items: files })
      router.replace(folderId ? `/drive/${folderId}` : "/drive", { scroll: false })
    }
  }, [previewId, data, openDialog, router, folderId])

  if (error instanceof ApiClientError && error.status === 404) {
    return (
      <div className="flex-1 overflow-y-auto px-4 sm:px-10">
        <NotFoundState />
      </div>
    )
  }

  const shared = data && data.role !== "OWNER"

  return (
    <>
      {inputs}
      <DropZone
        className="flex min-w-0 flex-1 flex-col"
        enabled={canEdit}
        target={{ parentId: folderId, parentName: folderName }}
      >
        <div className="flex-1 overflow-y-auto px-4 sm:px-10">
          <div className="max-w-[1240px]">
            <PageHeader
              loading={isLoading}
              crumbs={data?.breadcrumbs}
              title={folderName}
              icon={folderId ? Folder : undefined}
              color={data?.folder?.color}
              badges={
                shared && (
                  <Badge variant="outline" className="text-ink-muted">
                    {data.role === "EDITOR" ? "Can edit" : "View only"}
                  </Badge>
                )
              }
            />
            {!folderId && <PinnedShelf />}
            <ItemCollection
              heading={folderId ? undefined : "Files"}
              items={data?.items}
              isLoading={isLoading}
              context="drive"
              viewerId={me.id}
              columns={{ owner: true }}
              empty={
                <DropEmptyState
                  color={data?.folder?.color}
                  small={!!folderId}
                  title={canEdit ? "Drop files here, or" : "This folder is empty."}
                >
                  {canEdit && (
                    <>
                      <Button onClick={() => pickFiles()}>
                        <Upload /> Upload files
                      </Button>
                      <Button variant="secondary" onClick={() => openDialog("newFolder", { parentId: folderId })}>
                        <FolderPlus /> New folder
                      </Button>
                    </>
                  )}
                </DropEmptyState>
              }
            />
          </div>
        </div>
      </DropZone>
      <DetailsPanel items={data?.items ?? []} folder={data?.folder ?? null} />
    </>
  )
}
