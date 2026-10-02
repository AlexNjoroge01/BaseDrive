"use client"

import { create } from "zustand"

/** The folder the user is looking at, so the New menu and drop zone know where to put things. */
type CurrentFolder = {
  id: string | null
  name: string
  canEdit: boolean
  set: (f: { id: string | null; name: string; canEdit: boolean }) => void
}

export const useCurrentFolder = create<CurrentFolder>()((set) => ({
  id: null,
  name: "My Drive",
  canEdit: true,
  set: (f) => set(f),
}))
