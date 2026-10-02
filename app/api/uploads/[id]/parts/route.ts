import { NextResponse } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { presignParts } from "@/lib/uploads"
import { idSchema, presignPartsSchema } from "@/lib/validation"

/** POST /api/uploads/:id/parts — presigned PUT URLs (5 min) for the given parts. */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const { partNumbers } = await readJson(req, presignPartsSchema)
  return NextResponse.json(await presignParts(userId, id, partNumbers))
})
