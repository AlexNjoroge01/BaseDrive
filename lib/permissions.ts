import { and, eq, inArray } from "drizzle-orm"
import { db, type DbOrTx } from "@/db"
import { items, shareGrants, shareLinks, type Item, type Role } from "@/db/schema"
import { pathIds } from "@/lib/paths"
import { hashToken } from "@/lib/tokens"
import { notFound, ApiError } from "@/lib/api"

export type EffectiveRole = "OWNER" | Role

const RANK: Record<EffectiveRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 }

export type Action =
  | "view" // list, preview, download
  | "edit" // upload into, rename, move within tree, trash, restore
  | "share" // share, create links
  | "delete" // delete forever

const REQUIRED: Record<Action, EffectiveRole> = {
  view: "VIEWER",
  edit: "EDITOR",
  share: "OWNER",
  delete: "OWNER",
}

export function can(role: EffectiveRole | null, action: Action): boolean {
  if (!role) return false
  return RANK[role] >= RANK[REQUIRED[action]]
}

export function maxRole(
  a: EffectiveRole | null,
  b: EffectiveRole | null
): EffectiveRole | null {
  if (!a) return b
  if (!b) return a
  return RANK[a] >= RANK[b] ? a : b
}

export type RoleInput = {
  item: Pick<Item, "id" | "ownerId" | "path">
  userId: string | null
  grants: { itemId: string; userId: string; role: Role }[]
  link?: {
    itemId: string
    role: Role
    expiresAt: Date | null
    revokedAt: Date | null
    passwordHash: string | null
    /** Whether the visitor has proven the link password. */
    passwordOk?: boolean
  } | null
  now?: Date
}

/**
 * Effective role for a user on an item (Blueprint §6):
 * 1. owner → OWNER
 * 2. highest grant on the item or any ancestor
 * 3. a valid share link on the item or any ancestor
 * otherwise null, which callers turn into a 404.
 * Pure: everything it needs is passed in.
 */
export function resolveRole({
  item,
  userId,
  grants,
  link,
  now = new Date(),
}: RoleInput): EffectiveRole | null {
  if (userId && userId === item.ownerId) return "OWNER"

  const chain = new Set(pathIds(item.path))
  let role: EffectiveRole | null = null

  if (userId) {
    for (const g of grants) {
      if (g.userId === userId && chain.has(g.itemId)) role = maxRole(role, g.role)
    }
  }

  if (link && linkUsable(link, now) && chain.has(link.itemId)) {
    role = maxRole(role, link.role)
  }

  return role
}

export function linkUsable(
  link: NonNullable<RoleInput["link"]>,
  now = new Date()
): boolean {
  if (link.revokedAt) return false
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return false
  if (link.passwordHash && !link.passwordOk) return false
  return true
}

export type LinkContext = { token: string; passwordOk?: boolean }

/** Loads what resolveRole needs and runs it. */
export async function getEffectiveRole(
  userId: string | null,
  itemId: string,
  linkCtx?: LinkContext,
  tx: DbOrTx = db
): Promise<{ item: Item; role: EffectiveRole | null }> {
  const item = await tx.query.items.findFirst({ where: eq(items.id, itemId) })
  if (!item) throw notFound()
  if (userId === item.ownerId) return { item, role: "OWNER" }

  const chain = pathIds(item.path)
  const grants = userId
    ? await tx
        .select({
          itemId: shareGrants.itemId,
          userId: shareGrants.userId,
          role: shareGrants.role,
        })
        .from(shareGrants)
        .where(and(eq(shareGrants.userId, userId), inArray(shareGrants.itemId, chain)))
    : []

  let link: RoleInput["link"] = null
  if (linkCtx?.token) {
    const found = await tx.query.shareLinks.findFirst({
      where: eq(shareLinks.tokenHash, hashToken(linkCtx.token)),
    })
    if (found) link = { ...found, passwordOk: linkCtx.passwordOk }
  }

  return { item, role: resolveRole({ item, userId, grants, link }) }
}

/**
 * The one call every route makes: returns the item if the user may perform
 * the action, else throws. No access at all → 404 (don't leak existence);
 * some access but not enough → 403.
 */
export async function authorize(
  userId: string | null,
  itemId: string,
  action: Action,
  linkCtx?: LinkContext,
  tx: DbOrTx = db
): Promise<{ item: Item; role: EffectiveRole }> {
  const { item, role } = await getEffectiveRole(userId, itemId, linkCtx, tx)
  if (!role) throw notFound()
  if (!can(role, action)) {
    throw new ApiError("FORBIDDEN", "You don't have permission to do that.")
  }
  return { item, role }
}
