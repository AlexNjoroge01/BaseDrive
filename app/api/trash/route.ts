import { NextResponse, after } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { emptyTrash, listTrash } from "@/lib/items"
import { processJobs } from "@/lib/jobs/queue"

export const GET = route(async () => {
  const userId = await requireUserId()
  return NextResponse.json({ items: await listTrash(userId) })
})

/** DELETE /api/trash — empty trash. */
export const DELETE = route(async () => {
  const userId = await requireUserId()
  const res = await emptyTrash(userId)
  after(() => processJobs())
  return NextResponse.json(res)
})
