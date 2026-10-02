import { sql } from "drizzle-orm"
import { db, type DbOrTx } from "@/db"
import { jobs } from "@/db/schema"
import { processThumbnail } from "./processors/thumbnail"
import { processPurge } from "./processors/purge"

export type JobPayloads = {
  THUMBNAIL: { itemId: string }
  PURGE_ITEM: {
    storageKeys: string[]
    /** In-flight multipart uploads to abort. */
    multipart?: { key: string; uploadId: string }[]
  }
}
export type JobType = keyof JobPayloads

const MAX_ATTEMPTS = 5
const STALE_AFTER = "5 minutes"

export async function enqueue<T extends JobType>(
  tx: DbOrTx,
  type: T,
  payload: JobPayloads[T],
  runAt?: Date
) {
  await tx.insert(jobs).values({ type, payload, runAt: runAt ?? new Date() })
}

type ClaimedJob = {
  id: string
  type: JobType
  payload: unknown
  attempts: number
}

/** Claim one due job. SKIP LOCKED lets any number of workers run safely. */
export async function claimJob(): Promise<ClaimedJob | null> {
  const res = await db.execute<{
    id: string
    type: JobType
    payload: unknown
    attempts: number
  }>(sql`
    UPDATE jobs SET status = 'RUNNING', locked_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'PENDING' AND run_at <= now()
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts
  `)
  return res.rows[0] ?? null
}

async function runJob(job: ClaimedJob) {
  switch (job.type) {
    case "THUMBNAIL":
      return processThumbnail(job.payload as JobPayloads["THUMBNAIL"])
    case "PURGE_ITEM":
      return processPurge(job.payload as JobPayloads["PURGE_ITEM"])
  }
}

async function finish(job: ClaimedJob, error?: unknown) {
  if (!error) {
    await db.execute(
      sql`UPDATE jobs SET status = 'DONE', locked_at = NULL, error = NULL WHERE id = ${job.id}`
    )
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  if (job.attempts >= MAX_ATTEMPTS) {
    await db.execute(
      sql`UPDATE jobs SET status = 'FAILED', locked_at = NULL, error = ${message} WHERE id = ${job.id}`
    )
  } else {
    // Exponential backoff: 10s, 20s, 40s, 80s…
    const delaySeconds = 10 * 2 ** (job.attempts - 1)
    await db.execute(sql`
      UPDATE jobs SET status = 'PENDING', locked_at = NULL, error = ${message},
        run_at = now() + make_interval(secs => ${delaySeconds})
      WHERE id = ${job.id}
    `)
  }
}

/**
 * The one job processor. Vercel calls it from `after()` and cron;
 * the k8s worker calls it in a loop. Returns how many jobs ran.
 */
export async function processJobs({
  max = 25,
  deadlineMs = 20_000,
}: { max?: number; deadlineMs?: number } = {}) {
  const start = Date.now()
  let count = 0
  while (count < max && Date.now() - start < deadlineMs) {
    const job = await claimJob()
    if (!job) break
    try {
      await runJob(job)
      await finish(job)
    } catch (err) {
      console.error(`[jobs] ${job.type} ${job.id} failed`, err)
      await finish(job, err)
    }
    count++
  }
  return count
}

/** Reclaim RUNNING jobs whose worker died mid-flight. */
export async function reclaimStaleJobs() {
  const res = await db.execute(sql`
    UPDATE jobs SET status = 'PENDING', locked_at = NULL
    WHERE status = 'RUNNING' AND locked_at < now() - ${STALE_AFTER}::interval
    RETURNING id
  `)
  return res.rows.length
}
