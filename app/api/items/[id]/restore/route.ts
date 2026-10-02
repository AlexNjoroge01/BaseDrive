import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { restoreItems } from "@/lib/items"
import { idSchema } from "@/lib/validation"

export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  return NextResponse.json(await restoreItems(userId, [id]))
})
