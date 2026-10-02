import { NextResponse, type NextRequest } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { listFolderTree } from "@/lib/items"
import { idSchema } from "@/lib/validation"

/** GET /api/folders/tree?ownerId= — folders for the Move dialog. */
export const GET = route(async (req: NextRequest) => {
  const userId = await requireUserId()
  const raw = req.nextUrl.searchParams.get("ownerId")
  const ownerId = raw ? idSchema.parse(raw) : userId
  return NextResponse.json({ folders: await listFolderTree(userId, ownerId) })
})
