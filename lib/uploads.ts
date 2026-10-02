import { and, eq, isNull, lt, sql } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { db } from "@/db"
import { items, uploads, users } from "@/db/schema"
import { ApiError, isUniqueViolation, notFound } from "@/lib/api"
import { authorize } from "@/lib/permissions"
import { buildPath } from "@/lib/paths"
import { nextAvailableName } from "@/lib/names"
import { env, UPLOAD_PART_SIZE } from "@/lib/env"
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  headObject,
  listUploadedParts,
  objectKey,
  presignPart,
} from "@/lib/storage"
import { enqueue } from "@/lib/jobs/queue"
import { fileKind } from "@/lib/file-types"
import { formatBytes } from "@/lib/format"
import { getItemRow, resolveParent, siblingNames, toDTO, trashItems } from "@/lib/items"

const UPLOAD_TTL_MS = 24 * 60 * 60 * 1000

export async function startUpload(
  viewerId: string,
  input: {
    name: string
    size: number
    mimeType: string
    parentId: string | null
    onConflict: "fail" | "keepBoth" | "replace"
  }
) {
  if (input.size > env.maxFileBytes) {
    throw new ApiError(
      "FILE_TOO_LARGE",
      `Files can be up to ${formatBytes(env.maxFileBytes)}. This one is ${formatBytes(input.size)}.`
    )
  }

  const { parent, ownerId } = await resolveParent(viewerId, input.parentId)

  // Independent reads in parallel: each round trip to the DB counts.
  const [owner, [{ total }], taken] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, ownerId) }),
    db
      .select({ total: sql<number>`coalesce(sum(${users.storageUsed}), 0)`.mapWith(Number) })
      .from(users),
    siblingNames(ownerId, parent?.id ?? null),
  ])

  // Quota is checked against the drive owner, who pays for the bytes.
  if (!owner) throw notFound()
  const free = owner.storageQuota - owner.storageUsed
  if (input.size > free) {
    throw new ApiError(
      "QUOTA_EXCEEDED",
      `Not enough space: needs ${formatBytes(input.size)}, ${formatBytes(Math.max(0, free))} free.`,
      { needed: input.size, free: Math.max(0, free) }
    )
  }
  if (total + input.size > env.globalStorageCapBytes) {
    throw new ApiError(
      "QUOTA_EXCEEDED",
      "This demo has reached its total storage cap. Delete some files and try again."
    )
  }

  // Resolve name conflicts per the user's choice.
  let name = input.name
  const clash = [...taken].find((t) => t.toLowerCase() === name.toLowerCase())
  if (clash) {
    if (input.onConflict === "fail") {
      throw new ApiError("NAME_CONFLICT", `A file named ${clash} already exists here.`, { name: clash })
    }
    if (input.onConflict === "keepBoth") {
      name = nextAvailableName(name, taken)
    } else {
      const existing = await db.query.items.findFirst({
        where: and(
          eq(items.ownerId, ownerId),
          parent ? eq(items.parentId, parent.id) : isNull(items.parentId),
          sql`lower(${items.name}) = lower(${name})`,
          isNull(items.trashedAt)
        ),
      })
      if (existing?.type === "FOLDER") {
        throw new ApiError("NAME_CONFLICT", `A folder named ${clash} already exists here.`, { name: clash })
      }
      // Replace = old version goes to trash (recoverable for 30 days).
      if (existing) await trashItems(viewerId, [existing.id])
    }
  }

  const itemId = createId()
  const key = objectKey(ownerId, itemId)
  const s3UploadId = await createMultipartUpload(key, input.mimeType || "application/octet-stream")
  const totalParts = Math.max(1, Math.ceil(input.size / UPLOAD_PART_SIZE))

  try {
    await db.transaction(async (tx) => {
      await tx.insert(items).values({
        id: itemId,
        ownerId,
        parentId: parent?.id ?? null,
        type: "FILE",
        name,
        path: buildPath(parent?.path ?? null, itemId),
        mimeType: input.mimeType || "application/octet-stream",
        size: input.size,
        storageKey: key,
        status: "UPLOADING",
      })
      await tx.insert(uploads).values({
        itemId,
        s3UploadId,
        partSize: UPLOAD_PART_SIZE,
        totalParts,
        expiresAt: new Date(Date.now() + UPLOAD_TTL_MS),
      })
    })
  } catch (err) {
    await abortMultipartUpload(key, s3UploadId)
    if (isUniqueViolation(err)) {
      throw new ApiError("NAME_CONFLICT", `A file named ${name} already exists here.`, { name })
    }
    throw err
  }

  return { uploadId: itemId, itemId, name, partSize: UPLOAD_PART_SIZE, totalParts }
}

/** Upload ids are the item id: one upload per item. */
async function loadUpload(viewerId: string, itemId: string) {
  const { item } = await authorize(viewerId, itemId, "edit")
  const upload = await db.query.uploads.findFirst({ where: eq(uploads.itemId, itemId) })
  if (!upload || item.status !== "UPLOADING" || !item.storageKey) throw notFound("upload")
  return { item, upload, key: item.storageKey }
}

export async function presignParts(viewerId: string, itemId: string, partNumbers: number[]) {
  const { upload, key } = await loadUpload(viewerId, itemId)
  const bad = partNumbers.find((n) => n > upload.totalParts)
  if (bad) throw new ApiError("VALIDATION", `Part ${bad} is out of range.`)
  const urls = await Promise.all(
    partNumbers.map(async (n) => ({ partNumber: n, url: await presignPart(key, upload.s3UploadId, n) }))
  )
  return { urls }
}

export async function resumeInfo(viewerId: string, itemId: string) {
  const { item, upload, key } = await loadUpload(viewerId, itemId)
  const parts = await listUploadedParts(key, upload.s3UploadId)
  return {
    uploadId: item.id,
    name: item.name,
    size: item.size,
    partSize: upload.partSize,
    totalParts: upload.totalParts,
    completed: parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
  }
}

export async function completeUpload(
  viewerId: string,
  itemId: string,
  parts: { partNumber: number; etag: string }[]
) {
  const { item, upload, key } = await loadUpload(viewerId, itemId)
  if (parts.length !== upload.totalParts) {
    throw new ApiError("VALIDATION", `Expected ${upload.totalParts} parts, got ${parts.length}.`)
  }
  await completeMultipartUpload(key, upload.s3UploadId, parts)

  // Never trust the client's size for quota: ask the bucket.
  const head = await headObject(key)
  const size = head.size
  const isImage = fileKind(item.name, item.mimeType) === "image"

  await db.transaction(async (tx) => {
    await tx.update(items).set({ status: "READY", size }).where(eq(items.id, item.id))
    await tx.delete(uploads).where(eq(uploads.itemId, item.id))
    await tx
      .update(users)
      .set({ storageUsed: sql`${users.storageUsed} + ${size}` })
      .where(eq(users.id, item.ownerId))
    if (isImage) await enqueue(tx, "THUMBNAIL", { itemId: item.id })
  })

  const row = await getItemRow(item.id, viewerId)
  return { item: toDTO(row!), needsProcessing: isImage }
}

export async function abortUpload(viewerId: string, itemId: string) {
  const { item, upload, key } = await loadUpload(viewerId, itemId)
  await abortMultipartUpload(key, upload.s3UploadId)
  await db.delete(items).where(eq(items.id, item.id)) // upload row cascades
}

/** Cron: abort multipart uploads older than 24h and drop their items. */
export async function cleanupStaleUploads() {
  const stale = await db
    .select({ itemId: uploads.itemId, s3UploadId: uploads.s3UploadId, key: items.storageKey })
    .from(uploads)
    .innerJoin(items, eq(items.id, uploads.itemId))
    .where(lt(uploads.expiresAt, new Date()))
  for (const s of stale) {
    try {
      if (s.key) await abortMultipartUpload(s.key, s.s3UploadId)
      await db.delete(items).where(eq(items.id, s.itemId))
    } catch (err) {
      console.error("[cron] failed to clean upload", s.itemId, err)
    }
  }
  return stale.length
}
