import { NextResponse, type NextRequest } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { listFolder } from "@/lib/items"
import { idSchema } from "@/lib/validation"

/** GET /api/items?parentId= — list a folder (root when omitted). */
export const GET = route(async (req: NextRequest) => {
  const userId = await requireUserId()
  const raw = req.nextUrl.searchParams.get("parentId")
  const parentId = raw ? idSchema.parse(raw) : null
  return NextResponse.json(await listFolder(userId, parentId))
})
