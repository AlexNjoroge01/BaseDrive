import { NextResponse } from "next/server"
import { route, requireUserId, notFound } from "@/lib/api"
import { authorize } from "@/lib/permissions"
import { idSchema } from "@/lib/validation"
import { presignGet } from "@/lib/storage"

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const { item } = await authorize(userId, id, "view")
  if (!item.thumbnailKey) throw notFound("thumbnail")
  const url = await presignGet(item.thumbnailKey, {
    filename: `${item.id}.webp`,
    disposition: "inline",
    contentType: "image/webp",
  })
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, max-age=50" } })
})
