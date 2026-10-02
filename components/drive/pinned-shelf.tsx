"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { FolderCard } from "@/components/drive/folder-card"
import { useItemActions } from "@/components/drive/item-actions"
import { CollectionContext, type CollectionApi } from "@/components/drive/collection-context"
import { usePinned } from "@/lib/client/queries"
import { useDelayedFlag } from "@/components/drive/states"

/**
 * The Pinned shelf on My Drive: up to four folder cards (scrolls sideways
 * on mobile). Until the user pins their own, recent folders stand in.
 */
export function PinnedShelf() {
  const router = useRouter()
  const { data, isLoading } = usePinned()
  const items = React.useMemo(() => (data?.items ?? []).slice(0, 4), [data])
  const actionsFor = useItemActions("drive", items)
  const showSkeleton = useDelayedFlag(isLoading)

  const api: CollectionApi = {
    context: "drive",
    items,
    order: items.map((i) => i.id),
    actionsFor,
    openItem: (item) => router.push(`/drive/${item.id}`),
    onItemClick: (item) => router.push(`/drive/${item.id}`),
    selectedItems: () => [],
    isNew: () => false,
    canDrag: true,
    columns: {},
  }

  if (!isLoading && items.length === 0) return null

  return (
    <section aria-label="Pinned" className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-section">Pinned</h2>
        {data?.auto && (
          <Badge variant="secondary" className="text-ink-muted">
            Recent folders · right-click to pin your own
          </Badge>
        )}
      </div>
      <CollectionContext.Provider value={api}>
        <div className="-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] sm:overflow-visible sm:px-0 [&>*]:w-[200px] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto">
          {isLoading ? (
            showSkeleton &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[132px] rounded-2xl [animation-duration:1.2s]" />
            ))
          ) : (
            <AnimatePresence initial={false}>
              {items.map((f) => (
                <FolderCard key={f.id} item={f} size="shelf" selectable={false} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </CollectionContext.Provider>
    </section>
  )
}
