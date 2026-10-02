"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { shareLinks } from "@/db/schema"
import { hashToken, linkUnlockProof, unlockCookieName } from "@/lib/tokens"
import { verifyLinkPassword } from "@/lib/sharing"
import { rateLimit } from "@/lib/rate-limit"

export type UnlockState = { error?: string } | undefined

export async function unlockLink(_prev: UnlockState, form: FormData): Promise<UnlockState> {
  const token = String(form.get("token") ?? "")
  const password = String(form.get("password") ?? "")
  try {
    await rateLimit("unlock", 10, 5)
  } catch (err) {
    return { error: (err as Error).message }
  }
  const link = await db.query.shareLinks.findFirst({ where: eq(shareLinks.tokenHash, hashToken(token)) })
  if (!link || link.revokedAt || !link.passwordHash) return { error: "This link doesn't work anymore." }
  if (!password || !(await verifyLinkPassword(link, password))) {
    return { error: "That password isn't right." }
  }
  const jar = await cookies()
  jar.set(unlockCookieName(link.id), linkUnlockProof(link.id, link.passwordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  })
  redirect(`/s/${token}`)
}
