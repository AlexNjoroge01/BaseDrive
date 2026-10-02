/** k8s CronJob entrypoint: same runMaintenance() Vercel Cron calls via /api/cron. */
import { runMaintenance } from "@/lib/maintenance"

runMaintenance()
  .then((res) => {
    console.info("[maintenance]", JSON.stringify(res))
    process.exit(0)
  })
  .catch((err) => {
    console.error("[maintenance] failed", err)
    process.exit(1)
  })
