import { and, eq, inArray, isNull } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import bcrypt from "bcryptjs"
import { db } from "@/db"
import { items, shareGrants, shareLinks, users, type Item, type ShareLink } from "@/db/schema"
import { ApiError, notFound } from "@/lib/api"
import { authorize, linkUsable } from "@/lib/permissions"
import { pathIds } from "@/lib/paths"
import { hashToken, linkToken } from "@/lib/tokens"
import { env } from "@/lib/env"
import { isTrashed } from "@/lib/items"
import type { AccessEntry, AccessInfo, LinkDTO, PersonDTO, Role } from "@/lib/types"

const RANK = { VIEWER: 1, EDITOR: 2 } as const

export function linkUrl(linkId: string) {
  return `${env.appUrl.replace(/\/$/, "")}/s/${linkToken(linkId)}`
}

function linkDTO(link: ShareLink): LinkDTO {
  return {
    id: link.id,
    url: linkUrl(link.id),
    role: link.role,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    hasPassword: !!link.passwordHash,
    createdAt: link.createdAt.toISOString(),
  }
}

async function activeLink(itemId: string) {
  return db.query.shareLinks.findFirst({
    where: and(eq(shareLinks.itemId, itemId), isNull(shareLinks.revokedAt)),
  })
}

export async function getAccessInfo(viewerId: string, itemId: string): Promise<AccessInfo> {
  const { item, role } = await authorize(viewerId, itemId, "view")
  const chain = pathIds(item.path)

  const [owner, grants, chainItems, link] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, item.ownerId) }),
    db
      .select({
        itemId: shareGrants.itemId,
        role: shareGrants.role,
        user: { id: users.id, name: users.name, email: users.email, image: users.image },
      })
      .from(shareGrants)
      .innerJoin(users, eq(users.id, shareGrants.userId))
      .where(inArray(shareGrants.itemId, chain)),
    db.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, chain)),
    activeLink(item.id),
  ])
  const names = new Map(chainItems.map((c) => [c.id, c.name]))

  // One entry per person: the strongest grant, preferring a direct one on ties.
  const best = new Map<string, AccessEntry>()
  for (const g of grants) {
    const via = g.itemId === item.id ? undefined : { id: g.itemId, name: names.get(g.itemId) ?? "" }
    const prev = best.get(g.user.id)
    const better =
      !prev ||
      RANK[g.role] > RANK[prev.role as Role] ||
      (RANK[g.role] === RANK[prev.role as Role] && !via)
    if (better) best.set(g.user.id, { user: g.user, role: g.role, via })
  }

  const ownerDTO: PersonDTO = {
    id: owner!.id,
    name: owner!.name,
    email: owner!.email,
    image: owner!.image,
  }

  return {
    owner: ownerDTO,
    entries: [...best.values()].sort((a, b) =>
      (a.user.name ?? a.user.email).localeCompare(b.user.name ?? b.user.email)
    ),
    link: link && role === "OWNER" ? linkDTO(link) : null,
    canShare: role === "OWNER",
  }
}

export async function addGrant(viewerId: string, itemId: string, email: string, role: Role) {
  const { item } = await authorize(viewerId, itemId, "share")
  const target = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!target) {
    throw new ApiError("VALIDATION", `No BaseDrive account uses ${email}. Ask them to sign up first.`)
  }
  if (target.id === item.ownerId) {
    throw new ApiError("VALIDATION", "That's the owner. They already have full access.")
  }
  if (target.isGuest) {
    throw new ApiError("VALIDATION", "The demo guest account can't receive shares.")
  }
  const existing = await db.query.shareGrants.findFirst({
    where: and(eq(shareGrants.itemId, itemId), eq(shareGrants.userId, target.id)),
  })
  await db
    .insert(shareGrants)
    .values({ itemId, userId: target.id, role })
    .onConflictDoUpdate({
      target: [shareGrants.itemId, shareGrants.userId],
      set: { role },
    })
  return { item, target, isNew: !existing }
}

export async function removeGrant(viewerId: string, itemId: string, userId: string) {
  await authorize(viewerId, itemId, "share")
  await db
    .delete(shareGrants)
    .where(and(eq(shareGrants.itemId, itemId), eq(shareGrants.userId, userId)))
}

export async function upsertLink(
  viewerId: string,
  itemId: string,
  opts: { role?: Role; expiresAt?: Date | null; password?: string | null }
): Promise<LinkDTO> {
  await authorize(viewerId, itemId, "share")
  const passwordHash =
    opts.password === undefined
      ? undefined
      : opts.password === null
        ? null
        : await bcrypt.hash(opts.password, 10)

  const existing = await activeLink(itemId)
  if (existing) {
    const [updated] = await db
      .update(shareLinks)
      .set({
        ...(opts.role ? { role: opts.role } : {}),
        ...(opts.expiresAt !== undefined ? { expiresAt: opts.expiresAt } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
      })
      .where(eq(shareLinks.id, existing.id))
      .returning()
    return linkDTO(updated)
  }

  const id = createId()
  const [created] = await db
    .insert(shareLinks)
    .values({
      id,
      itemId,
      tokenHash: hashToken(linkToken(id)),
      role: opts.role ?? "VIEWER",
      expiresAt: opts.expiresAt ?? null,
      passwordHash: passwordHash ?? null,
    })
    .returning()
  return linkDTO(created)
}

export async function revokeLink(viewerId: string, linkId: string) {
  const link = await db.query.shareLinks.findFirst({ where: eq(shareLinks.id, linkId) })
  if (!link) throw notFound("link")
  await authorize(viewerId, link.itemId, "share")
  await db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, linkId))
}

/* ───────────────────────── public links ───────────────────────── */

export type ResolvedLink =
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "locked"; link: ShareLink; item: Item; sharer: PersonDTO }
  | { state: "ok"; link: ShareLink; item: Item; sharer: PersonDTO }

/** Resolve a public token to its link and root item. */
export async function resolveLink(token: string, unlocked: boolean): Promise<ResolvedLink> {
  if (!token || token.length > 128) return { state: "invalid" }
  const link = await db.query.shareLinks.findFirst({
    where: eq(shareLinks.tokenHash, hashToken(token)),
  })
  if (!link || link.revokedAt) return { state: "invalid" }
  if (link.expiresAt && link.expiresAt <= new Date()) return { state: "expired" }

  const item = await db.query.items.findFirst({ where: eq(items.id, link.itemId) })
  if (!item || (await isTrashed(item))) return { state: "invalid" }
  const owner = await db.query.users.findFirst({ where: eq(users.id, item.ownerId) })
  const sharer: PersonDTO = {
    id: owner!.id,
    name: owner!.name,
    email: owner!.email,
    image: owner!.image,
  }
  if (!linkUsable({ ...link, passwordOk: unlocked })) {
    return { state: "locked", link, item, sharer }
  }
  return { state: "ok", link, item, sharer }
}

export async function verifyLinkPassword(link: ShareLink, password: string) {
  if (!link.passwordHash) return true
  return bcrypt.compare(password, link.passwordHash)
}
