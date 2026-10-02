"use client"

import { create } from "zustand"

type Selection = {
  ids: Set<string>
  anchor: string | null
  focusId: string | null
  /** Plain click: select just this one. */
  selectOnly: (id: string) => void
  /** Ctrl/⌘-click or checkbox: toggle membership. */
  toggle: (id: string) => void
  /** Shift-click: range from the anchor in the visible order. */
  selectRange: (id: string, order: string[]) => void
  setMany: (ids: string[]) => void
  setFocus: (id: string | null) => void
  clear: () => void
}

export const useSelection = create<Selection>()((set) => ({
  ids: new Set(),
  anchor: null,
  focusId: null,
  selectOnly: (id) => set({ ids: new Set([id]), anchor: id, focusId: id }),
  toggle: (id) =>
    set((s) => {
      const ids = new Set(s.ids)
      if (ids.has(id)) ids.delete(id)
      else ids.add(id)
      return { ids, anchor: id, focusId: id }
    }),
  selectRange: (id, order) =>
    set((s) => {
      const a = s.anchor ? order.indexOf(s.anchor) : -1
      const b = order.indexOf(id)
      if (a < 0 || b < 0) return { ids: new Set([id]), anchor: id, focusId: id }
      const [lo, hi] = a < b ? [a, b] : [b, a]
      return { ids: new Set(order.slice(lo, hi + 1)), focusId: id }
    }),
  setMany: (ids) => set({ ids: new Set(ids) }),
  setFocus: (focusId) => set({ focusId }),
  clear: () => set({ ids: new Set(), anchor: null }),
}))
