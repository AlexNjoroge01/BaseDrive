import { NextResponse } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { removeGrant } from "@/lib/sharing"
import { idSchema } from "@/lib/validation"

export const DELETE = route(
  async (_req, { params }: { params: Promise<{ id: string; userId: string }> }) => {
    const viewerId = await requireUserId()
    const p = await params
    await removeGrant(viewerId, idSchema.parse(p.id), idSchema.parse(p.userId))
    return NextResponse.json({ ok: true })
  }
)
