"use client"

import * as React from "react"
import type { ItemDTO } from "@/lib/types"
import type { ItemAction } from "@/components/drive/item-actions"

/** URLs for thumbnails/downloads: private API by default, token-scoped on public links. */
export type ItemUrls = {
  thumb: (id: string) => string
  download: (id: string) => string
  inline: (id: string) => string
}

export const privateUrls: ItemUrls = {
  thumb: (id) => `/api/items/${id}/thumbnail`,
  download: (id) => `/api/items/${id}/download`,
  inline: (id) => `/api/items/${id}/download?inline=1`,
}

export const publicUrls = (token: string): ItemUrls => ({
  thumb: (id) => `/api/s/${token}/items/${id}/thumbnail`,
  download: (id) => `/api/s/${token}/items/${id}/download`,
  inline: (id) => `/api/s/${token}/items/${id}/download?inline=1`,
})

export const ItemUrlsContext = React.createContext<ItemUrls>(privateUrls)
export const useItemUrls = () => React.useContext(ItemUrlsContext)

export type CollectionApi = {
  context: "drive" | "trash" | "public"
  items: ItemDTO[]
  order: string[]
  actionsFor: (item: ItemDTO) => ItemAction[]
  openItem: (item: ItemDTO) => void
  onItemClick: (item: ItemDTO, e: React.MouseEvent) => void
  selectedItems: () => ItemDTO[]
  isNew: (id: string) => boolean
  canDrag: boolean
  columns: CollectionColumns
}

export type CollectionColumns = {
  owner?: boolean
  location?: boolean
  date?: "modified" | "deleted"
}

export const CollectionContext = React.createContext<CollectionApi | null>(null)
export function useCollection() {
  const ctx = React.useContext(CollectionContext)
  if (!ctx) throw new Error("useCollection outside ItemCollection")
  return ctx
}
