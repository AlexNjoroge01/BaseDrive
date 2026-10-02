import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { listPinned } from "@/lib/items"

/** GET /api/pinned — the Pinned shelf on My Drive. */
export const GET = route(async () => {
  const userId = await requireUserId()
  return NextResponse.json(await listPinned(userId))
})
