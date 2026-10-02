import { NextResponse, after } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { auth } from "@/lib/auth"
import { addGrant } from "@/lib/sharing"
import { grantSchema, idSchema } from "@/lib/validation"
import { sendShareEmail } from "@/lib/email"
import { env } from "@/lib/env"
import { rateLimit } from "@/lib/rate-limit"

/** POST /api/items/:id/grants — share with a person by email. */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  await rateLimit("grant", 30, 15, userId)
  const id = idSchema.parse((await params).id)
  const { email, role } = await readJson(req, grantSchema)
  const { item, target, isNew } = await addGrant(userId, id, email, role)

  if (isNew) {
    const session = await auth()
    const sharerName = session?.user?.name || session?.user?.email || "Someone"
    after(() =>
      sendShareEmail({
        to: target.email,
        sharerName,
        itemName: item.name,
        itemType: item.type,
        role,
        url: item.type === "FOLDER" ? `${env.appUrl}/drive/${item.id}` : `${env.appUrl}/shared`,
      })
    )
  }
  return NextResponse.json({ ok: true, name: target.name ?? target.email })
})
