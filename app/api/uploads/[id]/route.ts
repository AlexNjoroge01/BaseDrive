import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { abortUpload, resumeInfo } from "@/lib/uploads"
import { idSchema } from "@/lib/validation"

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/uploads/:id — resume info (ListParts → completed part numbers). */
export const GET = route(async (_req, { params }: Ctx) => {
  const userId = await requireUserId()
  return NextResponse.json(await resumeInfo(userId, idSchema.parse((await params).id)))
})

/** DELETE /api/uploads/:id — abort. */
export const DELETE = route(async (_req, { params }: Ctx) => {
  const userId = await requireUserId()
  await abortUpload(userId, idSchema.parse((await params).id))
  return NextResponse.json({ ok: true })
})
