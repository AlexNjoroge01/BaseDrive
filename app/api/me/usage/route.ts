import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { getUsage } from "@/lib/items"

export const GET = route(async () => {
  const userId = await requireUserId()
  return NextResponse.json(await getUsage(userId))
})
