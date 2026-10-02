import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { getAccessInfo } from "@/lib/sharing"
import { idSchema } from "@/lib/validation"

/** GET /api/items/:id/access — who has access, plus the public link (owner only). */
export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  return NextResponse.json(await getAccessInfo(userId, id))
})
