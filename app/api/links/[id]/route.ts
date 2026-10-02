import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { revokeLink } from "@/lib/sharing"
import { idSchema } from "@/lib/validation"

/** DELETE /api/links/:id — revoke a public link. */
export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  await revokeLink(userId, idSchema.parse((await params).id))
  return NextResponse.json({ ok: true })
})
