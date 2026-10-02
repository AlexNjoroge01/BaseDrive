import { NextResponse } from "next/server"
import { route, notFound } from "@/lib/api"
import { authorize } from "@/lib/permissions"
import { idSchema } from "@/lib/validation"
import { presignGet } from "@/lib/storage"
import { linkContext } from "@/lib/public-link"

type Ctx = { params: Promise<{ token: string; id: string }> }

export const GET = route(async (_req, { params }: Ctx) => {
  const p = await params
  const id = idSchema.parse(p.id)
  const { item } = await authorize(null, id, "view", await linkContext(p.token))
  if (!item.thumbnailKey) throw notFound("thumbnail")
  const url = await presignGet(item.thumbnailKey, {
    filename: `${item.id}.webp`,
    disposition: "inline",
    contentType: "image/webp",
  })
  return NextResponse.redirect(url)
})
