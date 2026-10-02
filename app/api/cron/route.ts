import { NextResponse, type NextRequest } from "next/server"
import { runMaintenance } from "@/lib/maintenance"
import { processJobs, reclaimStaleJobs } from "@/lib/jobs/queue"
import { safeEqual } from "@/lib/tokens"

export const dynamic = "force-dynamic"
export const maxDuration = 60

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const header = req.headers.get("authorization") ?? ""
  return !!secret && safeEqual(header, `Bearer ${secret}`)
}

/**
 * GET /api/cron — daily maintenance (Vercel Cron sends the Bearer secret).
 * GET /api/cron?task=jobs — just sweep the job queue.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Bad cron secret." } }, { status: 401 })
  }
  if (req.nextUrl.searchParams.get("task") === "jobs") {
    const reclaimed = await reclaimStaleJobs()
    return NextResponse.json({ reclaimed, jobsRun: await processJobs() })
  }
  return NextResponse.json(await runMaintenance())
}
