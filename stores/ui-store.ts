"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ItemDTO } from "@/lib/types"

export type ViewMode = "list" | "grid"
export type SortKey = "name" | "modified" | "size" | "owner"

type Prefs = {
  view: ViewMode
  compact: boolean
  sort: { key: SortKey; dir: "asc" | "desc" }
  detailsOpen: boolean
  setView: (v: ViewMode) => void
  setCompact: (v: boolean) => void
  setSort: (key: SortKey) => void
  toggleDetails: (open?: boolean) => void
}

/** Persisted view preferences. */
export const usePrefs = create<Prefs>()(
  persist(
    (set) => ({
      view: "list",
      compact: false,
      sort: { key: "name", dir: "asc" },
      detailsOpen: false,
      setView: (view) => set({ view }),
      setCompact: (compact) => set({ compact }),
      setSort: (key) =>
        set((s) => ({
          sort:
            s.sort.key === key
              ? { key, dir: s.sort.dir === "asc" ? "desc" : "asc" }
              : { key, dir: key === "name" || key === "owner" ? "asc" : "desc" },
        })),
      toggleDetails: (open) => set((s) => ({ detailsOpen: open ?? !s.detailsOpen })),
    }),
    { name: "basedrive.prefs" }
  )
)

type DialogState = {
  newFolder: { parentId: string | null } | null
  renameId: string | null
  move: { ids: string[]; ownerId: string; fromParentId: string | null } | null
  shareId: string | null
  preview: { id: string; items: ItemDTO[]; linkToken?: string } | null
  deleteIds: string[] | null
  searchOpen: boolean
  open: <K extends keyof Omit<DialogState, "open" | "close">>(key: K, value: DialogState[K]) => void
  close: (key: keyof Omit<DialogState, "open" | "close">) => void
}

/** Which dialog is open, so any menu or shortcut can open one. */
export const useDialogs = create<DialogState>()((set) => ({
  newFolder: null,
  renameId: null,
  move: null,
  shareId: null,
  preview: null,
  deleteIds: null,
  searchOpen: false,
  open: (key, value) => set({ [key]: value } as Partial<DialogState>),
  close: (key) =>
    set({ [key]: key === "searchOpen" ? false : null } as Partial<DialogState>),
}))
