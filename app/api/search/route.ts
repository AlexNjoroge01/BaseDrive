import { NextResponse, type NextRequest } from "next/server"
import { route, requireUserId } from "@/lib/api"
import { searchItems } from "@/lib/items"
import { searchSchema } from "@/lib/validation"

/** GET /api/search?q=&kind= — name search (ILIKE + trigram ranking). */
export const GET = route(async (req: NextRequest) => {
  const userId = await requireUserId()
  const { q, kind } = searchSchema.parse(Object.fromEntries(req.nextUrl.searchParams))
  return NextResponse.json({ items: await searchItems(userId, q, kind || undefined) })
})
