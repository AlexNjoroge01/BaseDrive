import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { listStarred } from "@/lib/items"

export const GET = route(async () => {
  const userId = await requireUserId()
  return NextResponse.json({ items: await listStarred(userId) })
})
