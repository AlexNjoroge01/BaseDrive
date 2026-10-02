import { NextResponse, type NextRequest } from "next/server"
import { route, requireUserId, notFound } from "@/lib/api"
import { authorize } from "@/lib/permissions"
import { isTrashed } from "@/lib/items"
import { idSchema } from "@/lib/validation"
import { downloadRedirect } from "@/lib/download"

/** GET /api/items/:id/download[?inline=1] — 302 to a 60s presigned GET. */
export const GET = route(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const userId = await requireUserId()
    const id = idSchema.parse((await params).id)
    const { item } = await authorize(userId, id, "view")
    if (item.ownerId !== userId && (await isTrashed(item))) throw notFound()
    const inline = req.nextUrl.searchParams.get("inline") === "1"
    return NextResponse.redirect(await downloadRedirect(item, inline))
  }
)
