"use client"

import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, ApiClientError } from "@/lib/client/api"
import { invalidateDrive, qk } from "@/lib/client/queries"
import { useUploads, type UploadEntry } from "@/stores/upload-store"
import { pluralize } from "@/lib/format"

/**
 * Browser side of the multipart flow (Blueprint §7):
 * start → presign parts in batches → PUT 3 parts in parallel straight to the
 * bucket (retry each 3x with backoff, keep ETags) → complete.
 * Going offline pauses; coming back asks the server which parts landed
 * (ListParts) and uploads only the missing ones.
 */

const PARALLEL_PARTS = 3
const PARALLEL_FILES = 2
const PART_RETRIES = 3
const PRESIGN_BATCH = 12

type Runtime = {
  file: File
  etags: Map<number, string>
  partLoaded: Map<number, number>
  xhrs: Set<XMLHttpRequest>
  aborted: boolean
}

const runtimes = new Map<string, Runtime>()
let queryClient: QueryClient | null = null
let listening = false

export function bindUploader(qc: QueryClient) {
  queryClient = qc
  if (listening || typeof window === "undefined") return
  listening = true
  window.addEventListener("online", () => {
    for (const e of useUploads.getState().entries) {
      if (e.status === "paused") void run(e.localId)
    }
    pump()
  })
}

const store = () => useUploads.getState()
const entry = (id: string) => store().entries.find((e) => e.localId === id)
const patch = (id: string, p: Partial<UploadEntry>) => store().patch(id, p)

let seq = 0
const localId = () => `u${Date.now().toString(36)}${(seq++).toString(36)}`

/* ───────────────────────── public API ───────────────────────── */

export function enqueueUploads(
  files: File[],
  target: { parentId: string | null; parentName: string }
) {
  const entries: UploadEntry[] = files.map((file) => {
    const id = localId()
    runtimes.set(id, {
      file,
      etags: new Map(),
      partLoaded: new Map(),
      xhrs: new Set(),
      aborted: false,
    })
    return {
      localId: id,
      name: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      parentId: target.parentId,
      parentName: target.parentName,
      loaded: 0,
      status: "queued",
      createdAt: Date.now(),
    }
  })
  store().add(entries)
  pump()
}

export function cancelUpload(id: string) {
  const rt = runtimes.get(id)
  const e = entry(id)
  if (!e) return
  if (rt) {
    rt.aborted = true
    rt.xhrs.forEach((x) => x.abort())
  }
  if (e.uploadId && e.status !== "done") {
    void api(`/api/uploads/${e.uploadId}`, { method: "DELETE" }).catch(() => {})
  }
  patch(id, { status: "canceled" })
  pump()
}

export function retryUpload(id: string) {
  const rt = runtimes.get(id)
  if (!rt) return
  rt.aborted = false
  patch(id, { status: "queued", error: undefined, errorCode: undefined })
  pump()
}

export function resolveConflict(id: string, choice: "keepBoth" | "replace") {
  const rt = runtimes.get(id)
  if (!rt) return
  patch(id, { status: "queued", conflictName: undefined })
  void run(id, choice)
}

/* ───────────────────────── scheduler ───────────────────────── */

function pump() {
  const entries = store().entries
  const running = entries.filter((e) =>
    ["starting", "uploading", "completing"].includes(e.status)
  ).length
  const slots = PARALLEL_FILES - running
  if (slots <= 0) return
  entries
    .filter((e) => e.status === "queued")
    .slice(0, slots)
    .forEach((e) => void run(e.localId))
}

async function run(id: string, onConflict: "fail" | "keepBoth" | "replace" = "fail") {
  const rt = runtimes.get(id)
  let e = entry(id)
  if (!rt || !e) return
  rt.aborted = false

  try {
    if (!navigator.onLine) {
      patch(id, { status: "paused" })
      return
    }

    // 1. Start, or ask the server what already landed.
    if (!e.uploadId) {
      patch(id, { status: "starting" })
      const started = await api<{
        uploadId: string
        itemId: string
        name: string
        partSize: number
        totalParts: number
      }>("/api/uploads", {
        method: "POST",
        body: {
          name: e.name,
          size: e.size,
          mimeType: e.mimeType,
          parentId: e.parentId,
          onConflict,
        },
      })
      patch(id, {
        uploadId: started.uploadId,
        itemId: started.itemId,
        name: started.name,
        partSize: started.partSize,
        totalParts: started.totalParts,
      })
    } else {
      patch(id, { status: "starting" })
      const info = await api<{ completed: { partNumber: number; etag: string }[] }>(
        `/api/uploads/${e.uploadId}`
      )
      rt.etags = new Map(info.completed.map((p) => [p.partNumber, p.etag]))
      rt.partLoaded.clear()
    }
    e = entry(id)!
    if (rt.aborted) return

    // 2. Upload missing parts, PARALLEL_PARTS at a time.
    patch(id, { status: "uploading" })
    const partSize = e.partSize!
    const total = e.totalParts!
    const missing = Array.from({ length: total }, (_, i) => i + 1).filter(
      (n) => !rt.etags.has(n)
    )
    updateLoaded(id)

    for (let i = 0; i < missing.length; i += PRESIGN_BATCH) {
      const batch = missing.slice(i, i + PRESIGN_BATCH)
      const { urls } = await api<{ urls: { partNumber: number; url: string }[] }>(
        `/api/uploads/${e.uploadId}/parts`,
        { method: "POST", body: { partNumbers: batch } }
      )
      const queue = [...urls]
      const workers = Array.from({ length: Math.min(PARALLEL_PARTS, queue.length) }, async () => {
        while (queue.length && !rt.aborted) {
          const { partNumber, url } = queue.shift()!
          const blob = rt.file.slice((partNumber - 1) * partSize, partNumber * partSize)
          const etag = await putPartWithRetry(id, rt, url, blob, partNumber)
          rt.etags.set(partNumber, etag)
        }
      })
      await Promise.all(workers)
      if (rt.aborted) return
    }

    // 3. Complete.
    patch(id, { status: "completing", loaded: e.size })
    await api(`/api/uploads/${e.uploadId}/complete`, {
      method: "POST",
      body: {
        parts: [...rt.etags.entries()].map(([partNumber, etag]) => ({ partNumber, etag })),
      },
    })
    patch(id, { status: "done", finishedAt: Date.now() })
    runtimes.delete(id)
    onUploaded(e.parentId)
  } catch (err) {
    if (rt.aborted && entry(id)?.status === "canceled") return
    handleFailure(id, err)
  } finally {
    pump()
  }
}

function handleFailure(id: string, err: unknown) {
  const e = entry(id)
  if (!e) return
  if (err instanceof ApiClientError && err.code === "NAME_CONFLICT") {
    patch(id, { status: "conflict", conflictName: String(err.details.name ?? e.name) })
    return
  }
  if (!navigator.onLine || (err instanceof ApiClientError && err.code === "NETWORK")) {
    patch(id, { status: "paused" })
    return
  }
  if (err instanceof PartError && !navigator.onLine) {
    patch(id, { status: "paused" })
    return
  }
  const pct = e.size ? Math.round((e.loaded / e.size) * 100) : 0
  const message =
    err instanceof ApiClientError
      ? err.message
      : `Couldn't upload, connection dropped at ${pct}%.`
  patch(id, {
    status: "error",
    error: message,
    errorCode: err instanceof ApiClientError ? err.code : "NETWORK",
  })
}

/* ───────────────────────── parts ───────────────────────── */

class PartError extends Error {}

async function putPartWithRetry(
  id: string,
  rt: Runtime,
  url: string,
  blob: Blob,
  partNumber: number
): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= PART_RETRIES; attempt++) {
    if (rt.aborted) throw new PartError("aborted")
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
      if (!navigator.onLine) throw new PartError("offline")
    }
    try {
      return await putPart(id, rt, url, blob, partNumber)
    } catch (err) {
      lastErr = err
      rt.partLoaded.set(partNumber, 0)
      updateLoaded(id)
    }
  }
  throw lastErr
}

function putPart(
  id: string,
  rt: Runtime,
  url: string,
  blob: Blob,
  partNumber: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    rt.xhrs.add(xhr)
    xhr.open("PUT", url)
    xhr.upload.onprogress = (ev) => {
      rt.partLoaded.set(partNumber, ev.loaded)
      updateLoaded(id)
    }
    xhr.onload = () => {
      rt.xhrs.delete(xhr)
      if (xhr.status >= 200 && xhr.status < 300) {
        // Bucket CORS must expose ETag or this is null (the #1 gotcha).
        const etag = xhr.getResponseHeader("ETag")
        if (!etag) {
          reject(new PartError("Storage didn't expose the ETag header (check bucket CORS)."))
          return
        }
        rt.partLoaded.set(partNumber, blob.size)
        updateLoaded(id)
        resolve(etag)
      } else {
        reject(new PartError(`Part ${partNumber} failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => {
      rt.xhrs.delete(xhr)
      reject(new PartError("network"))
    }
    xhr.onabort = () => {
      rt.xhrs.delete(xhr)
      reject(new PartError("aborted"))
    }
    xhr.send(blob)
  })
}

let raf = 0
const dirty = new Set<string>()
function updateLoaded(id: string) {
  dirty.add(id)
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    for (const d of dirty) {
      const rt = runtimes.get(d)
      const e = entry(d)
      if (!rt || !e || !e.partSize) continue
      let loaded = 0
      for (const n of rt.etags.keys()) {
        loaded += Math.min(e.partSize, e.size - (n - 1) * e.partSize)
      }
      for (const [n, l] of rt.partLoaded) if (!rt.etags.has(n)) loaded += l
      patch(d, { loaded: Math.min(loaded, e.size) })
    }
    dirty.clear()
  })
}

/* ───────────────────────── completion ───────────────────────── */

let doneBatch = 0
let doneTimer: ReturnType<typeof setTimeout> | null = null

function onUploaded(parentId: string | null) {
  if (queryClient) {
    queryClient.invalidateQueries({ queryKey: qk.folder(parentId) })
    queryClient.invalidateQueries({ queryKey: qk.usage })
    queryClient.invalidateQueries({ queryKey: ["list", "recent"] })
    // Thumbnails are generated after the response; refetch once they're likely ready.
    setTimeout(() => queryClient && invalidateDrive(queryClient), 2500)
  }
  doneBatch++
  if (doneTimer) clearTimeout(doneTimer)
  doneTimer = setTimeout(() => {
    const still = store().entries.some((e) =>
      ["queued", "starting", "uploading", "completing"].includes(e.status)
    )
    if (!still) {
      toast.success(`${pluralize(doneBatch, "file")} uploaded`)
      doneBatch = 0
    }
  }, 400)
}
