import { NextResponse, type NextRequest } from "next/server"
import { route, notFound } from "@/lib/api"
import { authorize } from "@/lib/permissions"
import { isTrashed } from "@/lib/items"
import { idSchema } from "@/lib/validation"
import { downloadRedirect } from "@/lib/download"
import { linkContext } from "@/lib/public-link"

type Ctx = { params: Promise<{ token: string; id: string }> }

/** Public download through a share link (token presented to getEffectiveRole). */
export const GET = route(async (req: NextRequest, { params }: Ctx) => {
  const p = await params
  const id = idSchema.parse(p.id)
  const { item } = await authorize(null, id, "view", await linkContext(p.token))
  if (await isTrashed(item)) throw notFound()
  const inline = req.nextUrl.searchParams.get("inline") === "1"
  return NextResponse.redirect(await downloadRedirect(item, inline))
})
