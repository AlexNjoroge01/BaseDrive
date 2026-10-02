"use client"

import { toast } from "sonner"
import { api, ApiClientError, errorMessage } from "@/lib/client/api"
import { enqueueUploads } from "@/lib/client/uploader"
import type { ItemDTO } from "@/lib/types"

export type RelFile = { file: File; path: string } // path like "Photos/2024/a.jpg"

/** Create the folder tree, then queue each file into its folder. */
export async function uploadWithFolders(
  files: RelFile[],
  target: { parentId: string | null; parentName: string },
  onFoldersCreated?: () => void
) {
  const loose = files.filter((f) => !f.path.includes("/"))
  if (loose.length) enqueueUploads(loose.map((f) => f.file), target)
  const nested = files.filter((f) => f.path.includes("/"))
  if (!nested.length) return

  const ids = new Map<string, { id: string; name: string }>()
  const dirs = [...new Set(nested.map((f) => f.path.split("/").slice(0, -1).join("/")))]
    .flatMap((d) => d.split("/").map((_, i, parts) => parts.slice(0, i + 1).join("/")))
  const unique = [...new Set(dirs)].sort((a, b) => a.split("/").length - b.split("/").length)

  try {
    for (const dir of unique) {
      const parts = dir.split("/")
      const name = parts.at(-1)!
      const parent = parts.length > 1 ? ids.get(parts.slice(0, -1).join("/"))! : null
      const parentId = parent?.id ?? target.parentId
      // Top-level folder name may clash; nested ones are fresh.
      let created: ItemDTO | null = null
      for (let n = 0; n < 20 && !created; n++) {
        const tryName = n === 0 ? name : `${name} (${n})`
        try {
          created = (
            await api<{ item: ItemDTO }>("/api/folders", {
              method: "POST",
              body: { name: tryName, parentId },
            })
          ).item
        } catch (err) {
          if (!(err instanceof ApiClientError && err.code === "NAME_CONFLICT")) throw err
        }
      }
      if (!created) throw new Error(`Couldn't create folder ${name}.`)
      ids.set(dir, { id: created.id, name: created.name })
    }
  } catch (err) {
    toast.error(`Couldn't create folders. ${errorMessage(err)}`)
    return
  }
  onFoldersCreated?.()

  const byDir = new Map<string, File[]>()
  for (const f of nested) {
    const dir = f.path.split("/").slice(0, -1).join("/")
    byDir.set(dir, [...(byDir.get(dir) ?? []), f.file])
  }
  for (const [dir, list] of byDir) {
    const folder = ids.get(dir)!
    enqueueUploads(list, { parentId: folder.id, parentName: folder.name })
  }
}

/** Walk a drop's DataTransfer, including folders (webkitGetAsEntry). */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<RelFile[]> {
  const entries = [...dt.items]
    .map((i) => (i.kind === "file" ? i.webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e)
  if (!entries.length) return [...dt.files].map((file) => ({ file, path: file.name }))

  const out: RelFile[] = []
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) =>
        (entry as FileSystemFileEntry).file(res, rej)
      )
      out.push({ file, path: prefix + file.name })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      let batch: FileSystemEntry[] = []
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`)
      } while (batch.length)
    }
  }
  for (const e of entries) await walk(e, "")
  return out
}
