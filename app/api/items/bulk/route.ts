import { NextResponse, after } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { deleteForever, moveItems, restoreItems, trashItems } from "@/lib/items"
import { bulkSchema } from "@/lib/validation"
import { processJobs } from "@/lib/jobs/queue"

/** POST /api/items/bulk — multi-select move / trash / restore / delete. */
export const POST = route(async (req) => {
  const userId = await requireUserId()
  const body = await readJson(req, bulkSchema)
  switch (body.action) {
    case "move":
      return NextResponse.json(await moveItems(userId, body.ids, body.parentId))
    case "trash":
      return NextResponse.json(await trashItems(userId, body.ids))
    case "restore":
      return NextResponse.json(await restoreItems(userId, body.ids))
    case "delete": {
      const res = await deleteForever(userId, body.ids)
      after(() => processJobs())
      return NextResponse.json(res)
    }
  }
})
