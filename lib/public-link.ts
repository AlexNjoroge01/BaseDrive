import { cookies } from "next/headers"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { shareLinks } from "@/db/schema"
import { hashToken, linkUnlockProof, safeEqual, unlockCookieName } from "@/lib/tokens"
import type { LinkContext } from "@/lib/permissions"

/** Has this visitor proven the link password (via the unlock cookie)? */
export async function isUnlocked(link: { id: string; passwordHash: string | null }) {
  if (!link.passwordHash) return true
  const jar = await cookies()
  const proof = jar.get(unlockCookieName(link.id))?.value
  return !!proof && safeEqual(proof, linkUnlockProof(link.id, link.passwordHash))
}

/** Link context for getEffectiveRole from a raw token. */
export async function linkContext(token: string): Promise<LinkContext> {
  const link = await db.query.shareLinks.findFirst({
    where: eq(shareLinks.tokenHash, hashToken(token)),
  })
  return { token, passwordOk: link ? await isUnlocked(link) : false }
}
