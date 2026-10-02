"use client"

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { api, errorMessage } from "@/lib/client/api"
import type {
  AccessInfo,
  FolderColor,
  FolderListing,
  ItemDTO,
  ItemDetails,
  LinkDTO,
  Role,
  UsageDTO,
} from "@/lib/types"
import { pluralize } from "@/lib/format"

/* ───────────────────────── keys ───────────────────────── */

export type ListKind = "shared" | "recent" | "starred" | "trash"

export const qk = {
  folder: (id: string | null) => ["folder", id ?? "root"] as const,
  list: (kind: ListKind) => ["list", kind] as const,
  item: (id: string) => ["item", id] as const,
  usage: ["usage"] as const,
  search: (q: string, kind?: string) => ["search", q, kind ?? ""] as const,
  access: (id: string) => ["access", id] as const,
  tree: (ownerId: string) => ["tree", ownerId] as const,
  pinned: ["list", "pinned"] as const,
}

/* ───────────────────────── reads ───────────────────────── */

export function useFolder(folderId: string | null) {
  return useQuery({
    queryKey: qk.folder(folderId),
    queryFn: () =>
      api<FolderListing>(`/api/items${folderId ? `?parentId=${folderId}` : ""}`),
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  })
}

export function useList(kind: ListKind) {
  return useQuery({
    queryKey: qk.list(kind),
    queryFn: () => api<{ items: ItemDTO[] }>(`/api/${kind}`).then((r) => r.items),
  })
}

export function usePinned() {
  return useQuery({
    queryKey: qk.pinned,
    queryFn: () => api<{ items: ItemDTO[]; auto: boolean }>("/api/pinned"),
  })
}

export function useItem(id: string | null) {
  return useQuery({
    queryKey: qk.item(id ?? ""),
    queryFn: () => api<ItemDetails>(`/api/items/${id}`),
    enabled: !!id,
  })
}

export function useUsage() {
  return useQuery({
    queryKey: qk.usage,
    queryFn: () => api<UsageDTO>("/api/me/usage"),
    staleTime: 30_000,
  })
}

export function useSearch(q: string, kind?: string) {
  return useQuery({
    queryKey: qk.search(q, kind),
    queryFn: () =>
      api<{ items: ItemDTO[] }>(
        `/api/search?q=${encodeURIComponent(q)}${kind ? `&kind=${kind}` : ""}`
      ).then((r) => r.items),
    enabled: q.length > 0 || !!kind,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  })
}

export function useAccess(id: string | null) {
  return useQuery({
    queryKey: qk.access(id ?? ""),
    queryFn: () => api<AccessInfo>(`/api/items/${id}/access`),
    enabled: !!id,
  })
}

export type TreeFolder = { id: string; name: string; parentId: string | null; path: string; color: FolderColor }

export function useFolderTree(ownerId: string | null) {
  return useQuery({
    queryKey: qk.tree(ownerId ?? ""),
    queryFn: () =>
      api<{ folders: TreeFolder[] }>(`/api/folders/tree?ownerId=${ownerId}`).then(
        (r) => r.folders
      ),
    enabled: !!ownerId,
  })
}

/* ───────────────────────── cache helpers ───────────────────────── */

/** Apply a change to every cached listing that might contain these items. */
function patchListings(
  qc: QueryClient,
  fn: (items: ItemDTO[]) => ItemDTO[]
) {
  qc.setQueriesData<FolderListing>({ queryKey: ["folder"] }, (old) =>
    old ? { ...old, items: fn(old.items), folder: old.folder ? fn([old.folder])[0] ?? old.folder : null } : old
  )
  qc.setQueriesData<ItemDTO[] | { items: ItemDTO[]; auto: boolean }>({ queryKey: ["list"] }, (old) =>
    !old ? old : Array.isArray(old) ? fn(old) : { ...old, items: fn(old.items) }
  )
}

async function snapshot(qc: QueryClient) {
  await qc.cancelQueries({ queryKey: ["folder"] })
  await qc.cancelQueries({ queryKey: ["list"] })
  return [
    ...qc.getQueriesData({ queryKey: ["folder"] }),
    ...qc.getQueriesData({ queryKey: ["list"] }),
  ]
}

function rollback(qc: QueryClient, snap?: [readonly unknown[], unknown][]) {
  snap?.forEach(([key, data]) => qc.setQueryData(key, data))
}

export function invalidateDrive(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["folder"] })
  qc.invalidateQueries({ queryKey: ["list"] })
  qc.invalidateQueries({ queryKey: ["item"] })
  qc.invalidateQueries({ queryKey: ["search"] })
  qc.invalidateQueries({ queryKey: ["tree"] })
}

/* ───────────────────────── mutations ───────────────────────── */

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { name: string; parentId: string | null }) =>
      api<{ item: ItemDTO }>("/api/folders", { method: "POST", body: v }).then((r) => r.item),
    onSuccess: (item) => {
      qc.setQueryData<FolderListing>(qk.folder(item.parentId), (old) =>
        old ? { ...old, items: [item, ...old.items] } : old
      )
      invalidateDrive(qc)
      toast.success("Folder created")
    },
  })
}

export function useRename() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      api<{ item: ItemDTO }>(`/api/items/${v.id}`, {
        method: "PATCH",
        body: { name: v.name },
      }).then((r) => r.item),
    onMutate: async ({ id, name }) => {
      const snap = await snapshot(qc)
      patchListings(qc, (list) => list.map((i) => (i.id === id ? { ...i, name } : i)))
      return { snap }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx?.snap),
    onSuccess: (item) => toast.success(`Renamed to ${item.name}`),
    onSettled: () => invalidateDrive(qc),
  })
}

type BulkResult = { moved?: number; targetName?: string; location?: string }

function bulk(body: unknown) {
  return api<BulkResult>("/api/items/bulk", { method: "POST", body })
}

export function useMove() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (v: {
      ids: string[]
      parentId: string | null
      fromParentId?: string | null
      silent?: boolean
    }) => bulk({ action: "move", ids: v.ids, parentId: v.parentId }),
    onMutate: async ({ ids, parentId }) => {
      const snap = await snapshot(qc)
      const set = new Set(ids)
      qc.setQueriesData<FolderListing>({ queryKey: ["folder"] }, (old) =>
        old && (old.folder?.id ?? null) !== parentId
          ? { ...old, items: old.items.filter((i) => !set.has(i.id)) }
          : old
      )
      return { snap }
    },
    onError: (err, v, ctx) => {
      rollback(qc, ctx?.snap)
      toast.error(`Couldn't move ${pluralize(v.ids.length, "item")}. ${errorMessage(err)}`, {
        action: { label: "Retry", onClick: () => mutation.mutate(v) },
      })
    },
    onSuccess: (res, v) => {
      if (v.silent) return
      toast.success(`Moved ${pluralize(v.ids.length, "item")} to ${res.targetName}`, {
        action:
          v.fromParentId !== undefined
            ? {
                label: "Undo",
                onClick: () =>
                  mutation.mutate({ ids: v.ids, parentId: v.fromParentId ?? null, silent: true }),
              }
            : undefined,
      })
    },
    onSettled: () => invalidateDrive(qc),
  })
  return mutation
}

export function useTrash() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[] }) => bulk({ action: "trash", ids: v.ids }),
    onMutate: async ({ ids }) => {
      const snap = await snapshot(qc)
      const set = new Set(ids)
      patchListings(qc, (list) => list.filter((i) => !set.has(i.id)))
      return { snap }
    },
    onError: (err, v, ctx) => {
      rollback(qc, ctx?.snap)
      toast.error(`Couldn't move ${pluralize(v.ids.length, "item")} to trash. ${errorMessage(err)}`)
    },
    onSuccess: (_r, v) => {
      toast.success(v.ids.length === 1 ? "Moved to trash" : `Moved ${v.ids.length} items to trash`, {
        action: {
          label: "Undo",
          onClick: () =>
            bulk({ action: "restore", ids: v.ids }).then(() => invalidateDrive(qc)),
        },
      })
    },
    onSettled: () => {
      invalidateDrive(qc)
      qc.invalidateQueries({ queryKey: qk.usage })
    },
  })
}

export function useRestore(onShow?: (res: BulkResult) => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[] }) => bulk({ action: "restore", ids: v.ids }),
    onMutate: async ({ ids }) => {
      const snap = await snapshot(qc)
      const set = new Set(ids)
      qc.setQueryData<ItemDTO[]>(qk.list("trash"), (old) => old?.filter((i) => !set.has(i.id)))
      return { snap }
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx?.snap)
      toast.error(`Couldn't restore. ${errorMessage(err)}`)
    },
    onSuccess: (res) =>
      toast.success(`Restored to ${res.location ?? "My Drive"}`, {
        action: onShow ? { label: "Show", onClick: () => onShow(res) } : undefined,
      }),
    onSettled: () => invalidateDrive(qc),
  })
}

export function useDeleteForever() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { ids: string[] } | { all: true }) =>
      "all" in v
        ? api("/api/trash", { method: "DELETE" })
        : bulk({ action: "delete", ids: v.ids }),
    onMutate: async (v) => {
      const snap = await snapshot(qc)
      qc.setQueryData<ItemDTO[]>(qk.list("trash"), (old) =>
        "all" in v ? [] : old?.filter((i) => !v.ids.includes(i.id))
      )
      return { snap }
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx?.snap)
      toast.error(`Couldn't delete. ${errorMessage(err)}`)
    },
    onSuccess: () => toast.success("Deleted forever"),
    onSettled: () => {
      invalidateDrive(qc)
      qc.invalidateQueries({ queryKey: qk.usage })
    },
  })
}

export function useStar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; starred: boolean }) =>
      api(`/api/items/${v.id}/star`, { method: "POST", body: { starred: v.starred } }),
    onMutate: async ({ id, starred }) => {
      const snap = await snapshot(qc)
      patchListings(qc, (list) => list.map((i) => (i.id === id ? { ...i, starred } : i)))
      return { snap }
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx?.snap)
      toast.error(errorMessage(err))
    },
    onSuccess: (_r, v) => toast.success(v.starred ? "Added to Starred" : "Removed from Starred"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.list("starred") })
      qc.invalidateQueries({ queryKey: ["item"] })
    },
  })
}

/* ───────────────────────── sharing ───────────────────────── */

export function useShareMutations(itemId: string) {
  const qc = useQueryClient()
  // A first load still in flight isn't cancelled by invalidate (it has no data
  // yet), so it would land after the mutation with stale access. Cancel it.
  const settle = () => qc.cancelQueries({ queryKey: qk.access(itemId) })
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.access(itemId) })
    qc.invalidateQueries({ queryKey: ["folder"] })
  }
  const grant = useMutation({
    mutationFn: (v: { email: string; role: Role }) =>
      api<{ name: string }>(`/api/items/${itemId}/grants`, { method: "POST", body: v }),
    onMutate: settle,
    onSuccess: refresh,
  })
  const revoke = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/items/${itemId}/grants/${userId}`, { method: "DELETE" }),
    onMutate: settle,
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  })
  const link = useMutation({
    mutationFn: (v: { role?: Role; expiresAt?: string | null; password?: string | null }) =>
      api<{ link: LinkDTO }>(`/api/items/${itemId}/links`, { method: "POST", body: v }).then(
        (r) => r.link
      ),
    onMutate: settle,
    onSuccess: (link) => {
      qc.setQueryData<AccessInfo>(qk.access(itemId), (old) => (old ? { ...old, link } : old))
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const unlink = useMutation({
    mutationFn: (linkId: string) => api(`/api/links/${linkId}`, { method: "DELETE" }),
    onMutate: settle,
    onSuccess: () => {
      qc.setQueryData<AccessInfo>(qk.access(itemId), (old) => (old ? { ...old, link: null } : old))
      refresh()
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return { grant, revoke, link, unlink }
}

/** Folder colour and pin: optimistic, since the change is its own feedback. */
export function useFolderLook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; name?: string; color?: FolderColor; pinned?: boolean }) =>
      api<{ item: ItemDTO }>(`/api/items/${v.id}`, {
        method: "PATCH",
        body: { color: v.color, pinned: v.pinned },
      }).then((r) => r.item),
    onMutate: async ({ id, color, pinned }) => {
      const snap = await snapshot(qc)
      await qc.cancelQueries({ queryKey: qk.pinned })
      patchListings(qc, (list) =>
        list.map((i) =>
          i.id === id
            ? { ...i, ...(color ? { color } : {}), ...(pinned !== undefined ? { pinned } : {}) }
            : i
        )
      )
      return { snap }
    },
    onError: (err, _v, ctx) => {
      rollback(qc, ctx?.snap)
      toast.error(errorMessage(err))
    },
    onSuccess: (item, v) => {
      if (v.pinned === true) toast.success(`Pinned ${item.name}`)
      if (v.pinned === false) toast.success(`Unpinned ${item.name}`)
    },
    onSettled: (_r, _e, v) => {
      if (v.pinned !== undefined) qc.invalidateQueries({ queryKey: qk.pinned })
      qc.invalidateQueries({ queryKey: ["item", v.id] })
    },
  })
}
