import { NextResponse } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { upsertLink } from "@/lib/sharing"
import { idSchema, linkSchema } from "@/lib/validation"

/** POST /api/items/:id/links — create (or update) the item's public link. */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const body = await readJson(req, linkSchema)
  return NextResponse.json({ link: await upsertLink(userId, id, body) })
})
