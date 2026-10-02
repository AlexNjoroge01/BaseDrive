import type { Item } from "@/db/schema"
import { ApiError, notFound } from "@/lib/api"
import { isInlineSafe, presignGet } from "@/lib/storage"
import { previewMode } from "@/lib/file-types"

/**
 * Presigned GET for a file. Downloads are forced to `attachment` unless the
 * MIME type is allow-listed for inline preview; text previews are served as
 * text/plain so uploaded HTML/SVG can never execute (stored XSS).
 */
export async function downloadRedirect(item: Item, wantInline: boolean) {
  if (item.type !== "FILE" || !item.storageKey) throw notFound("file")
  if (item.status !== "READY") throw new ApiError("NOT_FOUND", "This file is still uploading.")

  if (wantInline) {
    if (isInlineSafe(item.mimeType)) {
      return presignGet(item.storageKey, {
        filename: item.name,
        disposition: "inline",
        contentType: item.mimeType ?? undefined,
      })
    }
    if (previewMode(item.name, item.mimeType) === "text") {
      return presignGet(item.storageKey, {
        filename: item.name,
        disposition: "inline",
        contentType: "text/plain; charset=utf-8",
      })
    }
  }
  return presignGet(item.storageKey, { filename: item.name, disposition: "attachment" })
}
