/**
 * k8s worker entrypoint: polls the Postgres job queue.
 * Same processJobs() that Vercel runs from after()/cron; only the caller differs.
 */
import { processJobs, reclaimStaleJobs } from "@/lib/jobs/queue"

const IDLE_MS = 2_000
const SWEEP_EVERY_MS = 60_000
let running = true

process.on("SIGTERM", () => (running = false))
process.on("SIGINT", () => (running = false))

async function main() {
  console.info("[worker] started")
  let lastSweep = 0
  while (running) {
    try {
      if (Date.now() - lastSweep > SWEEP_EVERY_MS) {
        const reclaimed = await reclaimStaleJobs()
        if (reclaimed) console.info(`[worker] reclaimed ${reclaimed} stale jobs`)
        lastSweep = Date.now()
      }
      const ran = await processJobs({ max: 50, deadlineMs: 30_000 })
      if (ran) console.info(`[worker] ran ${ran} jobs`)
      else await new Promise((r) => setTimeout(r, IDLE_MS))
    } catch (err) {
      console.error("[worker] loop error", err)
      await new Promise((r) => setTimeout(r, IDLE_MS * 5))
    }
  }
  console.info("[worker] stopped")
  process.exit(0)
}

void main()
