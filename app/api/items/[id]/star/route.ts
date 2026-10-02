import { NextResponse } from "next/server"
import { z } from "zod"
import { route, requireUserId, readJson } from "@/lib/api"
import { setStar } from "@/lib/items"
import { idSchema } from "@/lib/validation"

export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const { starred } = await readJson(req, z.object({ starred: z.boolean() }))
  return NextResponse.json(await setStar(userId, id, starred))
})
