import { abortMultipartUpload, deleteObjects } from "@/lib/storage"

/**
 * Rows and quota are already gone (removed transactionally by purgeItemTree);
 * this deletes the bytes. Idempotent: deleting a missing key is a no-op.
 */
export async function processPurge({
  storageKeys,
  multipart = [],
}: {
  storageKeys: string[]
  multipart?: { key: string; uploadId: string }[]
}) {
  for (const m of multipart) await abortMultipartUpload(m.key, m.uploadId)
  await deleteObjects(storageKeys)
}
