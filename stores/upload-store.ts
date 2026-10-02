"use client"

import { create } from "zustand"

export type UploadStatus =
  | "queued"
  | "starting"
  | "uploading"
  | "paused" // offline; resumes automatically
  | "completing"
  | "done"
  | "conflict" // name exists; waiting for Keep both / Replace
  | "error"
  | "canceled"

export type UploadEntry = {
  localId: string
  name: string
  size: number
  mimeType: string
  parentId: string | null
  parentName: string
  /** Server upload id (the item id) once started. Kept for resume. */
  uploadId?: string
  itemId?: string
  partSize?: number
  totalParts?: number
  loaded: number
  status: UploadStatus
  error?: string
  /** Quota failures link to the trash. */
  errorCode?: string
  conflictName?: string
  createdAt: number
  finishedAt?: number
}

type UploadState = {
  entries: UploadEntry[]
  collapsed: boolean
  add: (entries: UploadEntry[]) => void
  patch: (localId: string, patch: Partial<UploadEntry>) => void
  remove: (localId: string) => void
  clearFinished: () => void
  setCollapsed: (v: boolean) => void
}

export const useUploads = create<UploadState>()((set) => ({
  entries: [],
  collapsed: false,
  add: (entries) => set((s) => ({ entries: [...s.entries, ...entries], collapsed: false })),
  patch: (localId, patch) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.localId === localId ? { ...e, ...patch } : e)),
    })),
  remove: (localId) => set((s) => ({ entries: s.entries.filter((e) => e.localId !== localId) })),
  clearFinished: () =>
    set((s) => ({
      entries: s.entries.filter((e) => !["done", "canceled"].includes(e.status)),
    })),
  setCollapsed: (collapsed) => set({ collapsed }),
}))

export const isActive = (e: UploadEntry) =>
  ["queued", "starting", "uploading", "paused", "completing"].includes(e.status)
