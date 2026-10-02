"use client"

import * as React from "react"
import { Clock, Star, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/drive/alert"
import { ItemCollection } from "@/components/drive/item-collection"
import { DetailsPanel } from "@/components/drive/details-panel"
import { PageHeader } from "@/components/drive/page-header"
import { EmptyState } from "@/components/drive/states"
import { useSessionUser } from "@/components/session-context"
import { useList, type ListKind } from "@/lib/client/queries"
import { useCurrentFolder } from "@/stores/drive-context"
import { useSelection } from "@/stores/selection-store"
import { useDialogs } from "@/stores/ui-store"
import { TRASH_RETENTION_DAYS } from "@/lib/env"

const CONFIG: Record<
  ListKind,
  { title: string; icon: typeof Users; empty: string; hint?: string }
> = {
  shared: {
    title: "Shared with me",
    icon: Users,
    empty: "Files people share with you show up here.",
  },
  recent: {
    title: "Recent",
    icon: Clock,
    empty: "Files you upload or change show up here.",
  },
  starred: {
    title: "Starred",
    icon: Star,
    empty: "Star files and folders to find them fast.",
    hint: "Right-click anything and choose Star.",
  },
  trash: {
    title: "Trash",
    icon: Trash2,
    empty: "Trash is empty.",
  },
}

export function ListView({ kind }: { kind: ListKind }) {
  const me = useSessionUser()
  const cfg = CONFIG[kind]
  const { data, isLoading } = useList(kind)
  const setCurrent = useCurrentFolder((s) => s.set)
  const clearSelection = useSelection((s) => s.clear)
  const openDialog = useDialogs((s) => s.open)

  React.useEffect(() => {
    clearSelection()
    // New items from here land in My Drive.
    setCurrent({ id: null, name: "My Drive", canEdit: true })
    document.title = `${cfg.title} · BaseDrive`
  }, [kind, cfg.title, clearSelection, setCurrent])

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 sm:px-10">
        <div className="max-w-[1240px]">
          <PageHeader title={cfg.title} icon={cfg.icon} showView={kind !== "trash"} />
          {kind === "trash" && (data?.length ?? 0) > 0 && (
            <Alert className="mb-6" tone="sun">
              <span className="flex-1">
                Items in Trash are deleted forever after {TRASH_RETENTION_DAYS} days.
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="font-bold text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => openDialog("deleteIds", ["__all__"])}
              >
                Empty trash
              </Button>
            </Alert>
          )}
          <ItemCollection
            items={data}
            isLoading={isLoading}
            context={kind === "trash" ? "trash" : "drive"}
            viewerId={me.id}
            columns={{
              owner: kind !== "trash",
              location: kind === "recent",
              date: kind === "trash" ? "deleted" : "modified",
            }}
            empty={<EmptyState icon={cfg.icon} title={cfg.empty} description={cfg.hint} />}
          />
        </div>
      </div>
      <DetailsPanel items={data ?? []} folder={null} />
    </>
  )
}
