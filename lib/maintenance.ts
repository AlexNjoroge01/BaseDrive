import { and, isNotNull, lt, sql } from "drizzle-orm"
import { db } from "@/db"
import { items } from "@/db/schema"
import { TRASH_RETENTION_DAYS } from "@/lib/env"
import { purgeItemTree } from "@/lib/items"
import { cleanupStaleUploads } from "@/lib/uploads"
import { processJobs, reclaimStaleJobs } from "@/lib/jobs/queue"
import { resetGuest } from "@/lib/guest"

/** Delete forever anything that has sat in the trash past the retention window. */
export async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86_400_000)
  const expired = await db
    .select({ id: items.id, path: items.path, ownerId: items.ownerId })
    .from(items)
    .where(
      and(
        isNotNull(items.trashedAt),
        lt(items.trashedAt, cutoff),
        // only the top of each trashed subtree
        sql`not exists (
          select 1 from items t
          where t.owner_id = ${items.ownerId} and t.trashed_at is not null
            and t.id <> ${items.id} and ${items.path} like t.path || '%'
        )`
      )
    )
  for (const item of expired) {
    await db.transaction((tx) => purgeItemTree(tx, item))
  }
  return expired.length
}

/** Daily maintenance (Vercel Cron or the k8s CronJob both call this). */
export async function runMaintenance({ resetGuestDrive = true } = {}) {
  const reclaimed = await reclaimStaleJobs()
  const purged = await purgeExpiredTrash()
  const abortedUploads = await cleanupStaleUploads()
  if (resetGuestDrive) await resetGuest()
  const jobsRun = await processJobs({ max: 200, deadlineMs: 50_000 })
  return { reclaimed, purged, abortedUploads, jobsRun, guestReset: resetGuestDrive }
}
