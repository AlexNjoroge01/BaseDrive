import { eq } from "drizzle-orm"
import sharp from "sharp"
import { db } from "@/db"
import { items } from "@/db/schema"
import { getObjectBytes, putObject, thumbnailKey } from "@/lib/storage"
import { fileKind } from "@/lib/file-types"

const MAX_SOURCE_BYTES = 50 * 1024 * 1024

/** Images only: 256px WebP to t/{itemId}.webp, then set thumbnailKey. */
export async function processThumbnail({ itemId }: { itemId: string }) {
  const item = await db.query.items.findFirst({ where: eq(items.id, itemId) })
  if (!item || !item.storageKey || item.status !== "READY") return
  if (fileKind(item.name, item.mimeType) !== "image") return
  if (item.size > MAX_SOURCE_BYTES) return

  const source = await getObjectBytes(item.storageKey)
  const thumb = await sharp(source, { failOn: "none", animated: false })
    .rotate() // respect EXIF orientation
    .resize(256, 256, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer()

  const key = thumbnailKey(item.id)
  await putObject(key, thumb, "image/webp")
  await db.update(items).set({ thumbnailKey: key }).where(eq(items.id, item.id))
}
