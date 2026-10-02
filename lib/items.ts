import { and, asc, desc, eq, inArray, isNull, isNotNull, ne, sql, getTableColumns } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { db, type DbOrTx, type Tx } from "@/db"
import { items, users, shareGrants, stars, uploads, type Item, type FolderColor } from "@/db/schema"
import { ApiError, isUniqueViolation, notFound } from "@/lib/api"
import { authorize, type EffectiveRole } from "@/lib/permissions"
import { ancestorIds, buildPath, canMoveInto, likePrefix, pathIds } from "@/lib/paths"
import { nextAvailableName } from "@/lib/names"
import { enqueue } from "@/lib/jobs/queue"
import { fileKind } from "@/lib/file-types"
import type { Crumb, FolderListing, ItemDTO, ItemDetails, UsageDTO } from "@/lib/types"

/* ───────────────────────── select + mapping ───────────────────────── */

export function itemSelect(viewerId: string | null) {
  return {
    item: getTableColumns(items),
    owner: { id: users.id, name: users.name, email: users.email, image: users.image },
    shared: sql<boolean>`(
      exists (select 1 from share_grants g where g.item_id = ${items.id})
      or exists (select 1 from share_links l where l.item_id = ${items.id} and l.revoked_at is null)
    )`.mapWith(Boolean),
    fileCount: sql<number>`case when ${items.type} = 'FOLDER' then (
      select count(*) from items c
      where c.owner_id = ${items.ownerId} and c.type = 'FILE' and c.status = 'READY'
        and c.trashed_at is null and c.path like ${items.path} || '%'
    ) end`.mapWith(Number),
    totalSize: sql<number>`case when ${items.type} = 'FOLDER' then (
      select coalesce(sum(c.size), 0) from items c
      where c.owner_id = ${items.ownerId} and c.type = 'FILE' and c.status = 'READY'
        and c.trashed_at is null and c.path like ${items.path} || '%'
    ) end`.mapWith(Number),
    starred: (viewerId
      ? sql<boolean>`exists (select 1 from stars s where s.item_id = ${items.id} and s.user_id = ${viewerId})`
      : sql<boolean>`false`
    ).mapWith(Boolean),
  }
}

type Row = {
  item: Item
  owner: { id: string; name: string | null; email: string; image: string | null }
  shared: boolean
  starred: boolean
  fileCount: number | null
  totalSize: number | null
}

export function toDTO(row: Row, role?: EffectiveRole): ItemDTO {
  const { item } = row
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    mimeType: item.mimeType,
    size: item.size,
    status: item.status,
    parentId: item.parentId,
    owner: row.owner,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    trashedAt: item.trashedAt?.toISOString() ?? null,
    hasThumbnail: !!item.thumbnailKey,
    color: item.color,
    pinned: !!item.pinnedAt,
    ...(item.type === "FOLDER" ? { fileCount: row.fileCount ?? 0, totalSize: row.totalSize ?? 0 } : {}),
    shared: row.shared,
    starred: row.starred,
    role,
  }
}

const ownRole = (r: Row, viewerId: string): EffectiveRole | undefined =>
  r.item.ownerId === viewerId ? "OWNER" : undefined

/** Hides items inside a trashed folder (and trashed items themselves). */
export const notInTrash = sql`not exists (
  select 1 from items t
  where t.owner_id = ${items.ownerId} and t.trashed_at is not null
    and ${items.path} like t.path || '%'
)`

/** Items the viewer owns, or that sit under something shared with them. */
export const accessibleTo = (viewerId: string) => sql`(
  ${items.ownerId} = ${viewerId}
  or exists (
    select 1 from share_grants g join items gi on gi.id = g.item_id
    where g.user_id = ${viewerId} and ${items.path} like gi.path || '%'
  )
)`

function selectRows(tx: DbOrTx, viewerId: string | null) {
  return tx.select(itemSelect(viewerId)).from(items).innerJoin(users, eq(users.id, items.ownerId))
}

export async function getItemRow(id: string, viewerId: string | null, tx: DbOrTx = db) {
  const [row] = await selectRows(tx, viewerId).where(eq(items.id, id)).limit(1)
  return row ?? null
}

/** True if the item or any ancestor is in the trash. */
export async function isTrashed(item: Pick<Item, "path" | "trashedAt" | "ownerId">, tx: DbOrTx = db) {
  if (item.trashedAt) return true
  const ids = ancestorIds(item.path)
  if (!ids.length) return false
  const [hit] = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(inArray(items.id, ids), isNotNull(items.trashedAt)))
    .limit(1)
  return !!hit
}

/* ───────────────────────── breadcrumbs ───────────────────────── */

export async function buildBreadcrumbs(
  viewerId: string,
  item: Pick<Item, "id" | "path" | "ownerId">,
  tx: DbOrTx = db
): Promise<Crumb[]> {
  const chain = pathIds(item.path)
  const rows = await tx
    .select({ id: items.id, name: items.name })
    .from(items)
    .where(inArray(items.id, chain))
  const byId = new Map(rows.map((r) => [r.id, r.name]))
  const crumbsFor = (ids: string[]) =>
    ids.map((id) => ({ id, name: byId.get(id) ?? "…", href: `/drive/${id}` }))

  if (item.ownerId === viewerId) {
    return [{ id: null, name: "My Drive", href: "/drive" }, ...crumbsFor(chain)]
  }
  // Shared: start at the highest folder the viewer was granted.
  const grants = await tx
    .select({ itemId: shareGrants.itemId })
    .from(shareGrants)
    .where(and(eq(shareGrants.userId, viewerId), inArray(shareGrants.itemId, chain)))
  const granted = new Set(grants.map((g) => g.itemId))
  const start = Math.max(0, chain.findIndex((id) => granted.has(id)))
  return [{ id: null, name: "Shared with me", href: "/shared" }, ...crumbsFor(chain.slice(start))]
}

/** "My Drive / Clients / Acme" for a set of items, in one query. */
export async function locationsFor(
  list: Pick<Item, "id" | "path" | "ownerId">[],
  viewerId: string,
  tx: DbOrTx = db
) {
  const ids = [...new Set(list.flatMap((i) => ancestorIds(i.path)))]
  const rows = ids.length
    ? await tx.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, ids))
    : []
  const names = new Map(rows.map((r) => [r.id, r.name]))
  return new Map(
    list.map((i) => {
      const root = i.ownerId === viewerId ? "My Drive" : "Shared with me"
      const parts = ancestorIds(i.path).map((id) => names.get(id) ?? "…")
      return [i.id, [root, ...parts].join(" / ")]
    })
  )
}

/* ───────────────────────── reads ───────────────────────── */

export async function listFolder(
  viewerId: string,
  folderId: string | null
): Promise<FolderListing> {
  if (!folderId) {
    const rows = await selectRows(db, viewerId)
      .where(
        and(
          eq(items.ownerId, viewerId),
          isNull(items.parentId),
          isNull(items.trashedAt),
          eq(items.status, "READY")
        )
      )
      .orderBy(desc(sql`${items.type} = 'FOLDER'`), asc(sql`lower(${items.name})`))
    return {
      folder: null,
      role: "OWNER",
      breadcrumbs: [{ id: null, name: "My Drive", href: "/drive" }],
      items: rows.map((r) => toDTO(r, "OWNER")),
    }
  }

  const { item: folder, role } = await authorize(viewerId, folderId, "view")
  if (folder.type !== "FOLDER" || (await isTrashed(folder))) throw notFound("folder")

  const [folderRow, rows, breadcrumbs] = await Promise.all([
    getItemRow(folderId, viewerId),
    selectRows(db, viewerId)
      .where(
        and(eq(items.parentId, folderId), isNull(items.trashedAt), eq(items.status, "READY"))
      )
      .orderBy(desc(sql`${items.type} = 'FOLDER'`), asc(sql`lower(${items.name})`)),
    buildBreadcrumbs(viewerId, folder),
  ])

  return {
    folder: toDTO(folderRow!, role),
    role,
    breadcrumbs,
    items: rows.map((r) => toDTO(r, role)),
  }
}

export async function getItemDetails(viewerId: string, id: string): Promise<ItemDetails> {
  const { item, role } = await authorize(viewerId, id, "view")
  if (item.ownerId !== viewerId && (await isTrashed(item))) throw notFound()
  const [row, breadcrumbs] = await Promise.all([
    getItemRow(id, viewerId),
    buildBreadcrumbs(viewerId, item),
  ])
  return { item: toDTO(row!, role), role, breadcrumbs }
}

/** Folder tree for the Move dialog: every folder the viewer can edit in one drive. */
export async function listFolderTree(viewerId: string, ownerId: string) {
  const rows = await db
    .select({ id: items.id, name: items.name, parentId: items.parentId, path: items.path, color: items.color })
    .from(items)
    .where(
      and(
        eq(items.ownerId, ownerId),
        eq(items.type, "FOLDER"),
        notInTrash,
        accessibleTo(viewerId)
      )
    )
    .orderBy(asc(sql`lower(${items.name})`))
  return rows
}

export async function listShared(viewerId: string): Promise<ItemDTO[]> {
  const rows = await db
    .select({ ...itemSelect(viewerId), grantRole: shareGrants.role })
    .from(items)
    .innerJoin(users, eq(users.id, items.ownerId))
    .innerJoin(shareGrants, eq(shareGrants.itemId, items.id))
    .where(
      and(
        eq(shareGrants.userId, viewerId),
        ne(items.ownerId, viewerId),
        eq(items.status, "READY"),
        notInTrash
      )
    )
    .orderBy(desc(shareGrants.createdAt))
  return rows.map((r) => toDTO(r, r.grantRole))
}

export async function listRecent(viewerId: string): Promise<ItemDTO[]> {
  const rows = await selectRows(db, viewerId)
    .where(
      and(
        accessibleTo(viewerId),
        eq(items.type, "FILE"),
        eq(items.status, "READY"),
        notInTrash
      )
    )
    .orderBy(desc(items.updatedAt))
    .limit(50)
  const locs = await locationsFor(rows.map((r) => r.item), viewerId)
  return rows.map((r) => ({ ...toDTO(r, ownRole(r, viewerId)), location: locs.get(r.item.id) }))
}

export async function listStarred(viewerId: string): Promise<ItemDTO[]> {
  const rows = await selectRows(db, viewerId)
    .innerJoin(stars, and(eq(stars.itemId, items.id), eq(stars.userId, viewerId)))
    .where(and(accessibleTo(viewerId), eq(items.status, "READY"), notInTrash))
    .orderBy(desc(sql`${items.type} = 'FOLDER'`), desc(stars.createdAt))
  return rows.map((r) => toDTO(r, ownRole(r, viewerId)))
}

export async function listTrash(viewerId: string): Promise<ItemDTO[]> {
  // Only top-level trashed items; their contents come back with them.
  const rows = await selectRows(db, viewerId)
    .where(
      and(
        eq(items.ownerId, viewerId),
        isNotNull(items.trashedAt),
        sql`not exists (
          select 1 from items t
          where t.owner_id = ${items.ownerId} and t.trashed_at is not null
            and t.id <> ${items.id} and ${items.path} like t.path || '%'
        )`
      )
    )
    .orderBy(desc(items.trashedAt))
  return rows.map((r) => toDTO(r, "OWNER"))
}

export async function searchItems(viewerId: string, q: string, kind?: string) {
  if (!q && !kind) return []
  const conditions = [accessibleTo(viewerId), eq(items.status, "READY"), notInTrash]
  if (q) conditions.push(sql`${items.name} ilike ${"%" + q.replace(/[\\%_]/g, "\\$&") + "%"}`)
  if (kind === "folder") conditions.push(eq(items.type, "FOLDER"))
  else if (kind) conditions.push(eq(items.type, "FILE"))

  const rows = await selectRows(db, viewerId)
    .where(and(...conditions))
    .orderBy(
      desc(sql`${items.type} = 'FOLDER'`),
      q ? desc(sql`similarity(${items.name}, ${q})`) : desc(items.updatedAt)
    )
    .limit(kind && kind !== "folder" ? 300 : 50)

  const filtered = kind
    ? rows.filter((r) => fileKind(r.item.name, r.item.mimeType, r.item.type) === kind).slice(0, 50)
    : rows
  const locs = await locationsFor(filtered.map((r) => r.item), viewerId)
  return filtered.map((r) => ({ ...toDTO(r, ownRole(r, viewerId)), location: locs.get(r.item.id) }))
}

export async function getUsage(viewerId: string): Promise<UsageDTO> {
  const [user] = await db
    .select({ used: users.storageUsed, quota: users.storageQuota })
    .from(users)
    .where(eq(users.id, viewerId))
  const groups = await db
    .select({
      mimeType: items.mimeType,
      ext: sql<string>`lower(coalesce(substring(${items.name} from '\\.([^.]+)$'), ''))`,
      bytes: sql<number>`sum(${items.size})`.mapWith(Number),
    })
    .from(items)
    .where(and(eq(items.ownerId, viewerId), eq(items.type, "FILE"), eq(items.status, "READY")))
    .groupBy(items.mimeType, sql`2`)

  const byKind = new Map<string, number>()
  for (const g of groups) {
    const kind = fileKind(g.ext ? `x.${g.ext}` : "x", g.mimeType)
    byKind.set(kind, (byKind.get(kind) ?? 0) + g.bytes)
  }
  return {
    used: user?.used ?? 0,
    quota: user?.quota ?? 0,
    byKind: [...byKind.entries()]
      .map(([kind, bytes]) => ({ kind, bytes }))
      .sort((a, b) => b.bytes - a.bytes),
  }
}

/* ───────────────────────── mutations ───────────────────────── */

const conflict = (name: string, type: "FILE" | "FOLDER" = "FILE") =>
  new ApiError(
    "NAME_CONFLICT",
    `A ${type === "FOLDER" ? "folder" : "file"} named ${name} already exists here.`,
    { name }
  )

/** Resolve where new items go: the parent's drive, after an edit check. */
export async function resolveParent(viewerId: string, parentId: string | null, tx: DbOrTx = db) {
  if (!parentId) return { parent: null, ownerId: viewerId }
  const { item: parent } = await authorize(viewerId, parentId, "edit", undefined, tx)
  if (parent.type !== "FOLDER" || (await isTrashed(parent, tx))) throw notFound("folder")
  return { parent, ownerId: parent.ownerId }
}

export async function siblingNames(ownerId: string, parentId: string | null, tx: DbOrTx = db) {
  const rows = await tx
    .select({ name: items.name })
    .from(items)
    .where(
      and(
        eq(items.ownerId, ownerId),
        parentId ? eq(items.parentId, parentId) : isNull(items.parentId),
        isNull(items.trashedAt)
      )
    )
  return new Set(rows.map((r) => r.name))
}

export async function createFolder(viewerId: string, parentId: string | null, name: string) {
  const { parent, ownerId } = await resolveParent(viewerId, parentId)
  const id = createId()
  try {
    await db.insert(items).values({
      id,
      ownerId,
      parentId: parent?.id ?? null,
      type: "FOLDER",
      name,
      path: buildPath(parent?.path ?? null, id),
    })
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(name, "FOLDER")
    throw err
  }
  const row = await getItemRow(id, viewerId)
  return toDTO(row!)
}

export async function renameItem(viewerId: string, id: string, name: string) {
  const { item, role } = await authorize(viewerId, id, "edit")
  if (item.trashedAt) throw notFound()
  try {
    await db.update(items).set({ name }).where(eq(items.id, id))
  } catch (err) {
    if (isUniqueViolation(err)) throw conflict(name, item.type)
    throw err
  }
  const row = await getItemRow(id, viewerId)
  return toDTO(row!, role)
}

/** Rewrite a subtree's paths in one statement. Caller holds the transaction. */
async function rewriteSubtree(tx: Tx, item: Item, newParent: Pick<Item, "id" | "path"> | null) {
  const newPath = buildPath(newParent?.path ?? null, item.id)
  await tx
    .update(items)
    .set({ parentId: newParent?.id ?? null })
    .where(eq(items.id, item.id))
  await tx.execute(sql`
    update items
    -- ::int matters: an untyped param resolves to text and picks the regex overload
    set path = ${newPath} || substring(path from ${item.path.length + 1}::int)
    where owner_id = ${item.ownerId} and path like ${likePrefix(item.path)}
  `)
  return newPath
}

export async function moveItems(viewerId: string, ids: string[], targetId: string | null) {
  return db.transaction(async (tx) => {
    let target: Item | null = null
    let targetOwner = viewerId
    if (targetId) {
      const res = await authorize(viewerId, targetId, "edit", undefined, tx)
      target = res.item
      if (target.type !== "FOLDER" || (await isTrashed(target, tx))) throw notFound("folder")
      targetOwner = target.ownerId
    }

    let moved = 0
    for (const id of ids) {
      const { item } = await authorize(viewerId, id, "edit", undefined, tx)
      if (item.trashedAt) throw notFound()
      if (item.ownerId !== targetOwner) {
        throw new ApiError("INVALID_MOVE", "Items can only move within the same drive.")
      }
      if (!canMoveInto(item.path, target?.path ?? null)) {
        throw new ApiError("INVALID_MOVE", "Can't move a folder inside itself.")
      }
      if (item.parentId === (target?.id ?? null)) continue
      try {
        await rewriteSubtree(tx, item, target)
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict(item.name, item.type)
        throw err
      }
      moved++
    }
    return { moved, targetName: target?.name ?? "My Drive" }
  })
}

export async function trashItems(viewerId: string, ids: string[]) {
  const now = new Date()
  for (const id of ids) {
    const { item } = await authorize(viewerId, id, "edit")
    if (item.trashedAt) continue
    await db.update(items).set({ trashedAt: now }).where(eq(items.id, id))
  }
  return { trashed: ids.length }
}

export async function restoreItems(viewerId: string, ids: string[]) {
  return db.transaction(async (tx) => {
    let location = "My Drive"
    for (const id of ids) {
      const { item } = await authorize(viewerId, id, "edit", undefined, tx)
      if (!item.trashedAt) continue

      // If the old parent is itself trashed or gone, restore to the drive root.
      let parent: Item | null = null
      if (item.parentId) {
        parent = (await tx.query.items.findFirst({ where: eq(items.id, item.parentId) })) ?? null
        if (parent && (await isTrashed(parent, tx))) parent = null
      }
      if (item.parentId && !parent) {
        await rewriteSubtree(tx, item, null)
      }

      const taken = await siblingNames(item.ownerId, parent?.id ?? null, tx)
      const name = nextAvailableName(item.name, taken)
      await tx.update(items).set({ trashedAt: null, name }).where(eq(items.id, id))

      if (parent) {
        const crumbs = await buildBreadcrumbs(viewerId, parent, tx)
        location = crumbs.slice(1).map((c) => c.name).join("/") || crumbs[0].name
      }
    }
    return { restored: ids.length, location }
  })
}

/**
 * Delete forever. Rows and quota change in one transaction; the bytes are
 * removed by a PURGE_ITEM job so a slow bucket never holds the request.
 */
export async function purgeItemTree(tx: Tx, item: Pick<Item, "id" | "path" | "ownerId">) {
  const subtree = await tx
    .select({
      id: items.id,
      storageKey: items.storageKey,
      thumbnailKey: items.thumbnailKey,
      size: items.size,
      status: items.status,
      type: items.type,
    })
    .from(items)
    .where(and(eq(items.ownerId, item.ownerId), sql`${items.path} like ${likePrefix(item.path)}`))

  const ids = subtree.map((r) => r.id)
  const pending = ids.length
    ? await tx
        .select({ itemId: uploads.itemId, s3UploadId: uploads.s3UploadId })
        .from(uploads)
        .where(inArray(uploads.itemId, ids))
    : []
  const keyOf = new Map(subtree.map((r) => [r.id, r.storageKey]))

  const bytes = subtree
    .filter((r) => r.type === "FILE" && r.status === "READY")
    .reduce((n, r) => n + r.size, 0)
  const keys = subtree.flatMap((r) =>
    [r.status === "READY" ? r.storageKey : null, r.thumbnailKey].filter((k): k is string => !!k)
  )

  await tx.execute(
    sql`delete from items where owner_id = ${item.ownerId} and path like ${likePrefix(item.path)}`
  )
  if (bytes) {
    await tx
      .update(users)
      .set({ storageUsed: sql`greatest(0, ${users.storageUsed} - ${bytes})` })
      .where(eq(users.id, item.ownerId))
  }
  if (keys.length || pending.length) {
    await enqueue(tx, "PURGE_ITEM", {
      storageKeys: keys,
      multipart: pending.map((p) => ({ key: keyOf.get(p.itemId)!, uploadId: p.s3UploadId })),
    })
  }
  return { count: ids.length, bytes }
}

export async function deleteForever(viewerId: string, ids: string[]) {
  return db.transaction(async (tx) => {
    let count = 0
    for (const id of ids) {
      const { item } = await authorize(viewerId, id, "delete", undefined, tx)
      count += (await purgeItemTree(tx, item)).count
    }
    return { deleted: count }
  })
}

export async function emptyTrash(viewerId: string) {
  const top = await listTrash(viewerId)
  if (!top.length) return { deleted: 0 }
  return deleteForever(
    viewerId,
    top.map((i) => i.id)
  )
}

export async function setStar(viewerId: string, id: string, starred: boolean) {
  await authorize(viewerId, id, "view")
  if (starred) {
    await db.insert(stars).values({ userId: viewerId, itemId: id }).onConflictDoNothing()
  } else {
    await db.delete(stars).where(and(eq(stars.userId, viewerId), eq(stars.itemId, id)))
  }
  return { starred }
}

/* ───────────────────────── folder colour + pins ───────────────────────── */

export async function updateFolderLook(
  viewerId: string,
  id: string,
  patch: { color?: FolderColor; pinned?: boolean }
) {
  const { item, role } = await authorize(viewerId, id, "edit")
  if (item.type !== "FOLDER") throw new ApiError("VALIDATION", "Only folders have colours and pins.")
  await db
    .update(items)
    .set({
      ...(patch.color ? { color: patch.color } : {}),
      ...(patch.pinned !== undefined ? { pinnedAt: patch.pinned ? new Date() : null } : {}),
    })
    .where(eq(items.id, id))
  const row = await getItemRow(id, viewerId)
  return toDTO(row!, role)
}

/**
 * The Pinned shelf: folders the user pinned, newest first. Until they pin
 * their own, the most recently changed folders stand in (auto = true).
 */
export async function listPinned(viewerId: string): Promise<{ items: ItemDTO[]; auto: boolean }> {
  const base = and(eq(items.ownerId, viewerId), eq(items.type, "FOLDER"), notInTrash)
  const pinned = await selectRows(db, viewerId)
    .where(and(base, isNotNull(items.pinnedAt)))
    .orderBy(desc(items.pinnedAt))
    .limit(8)
  if (pinned.length) return { items: pinned.map((r) => toDTO(r, "OWNER")), auto: false }
  const recent = await selectRows(db, viewerId).where(base).orderBy(desc(items.updatedAt)).limit(4)
  return { items: recent.map((r) => toDTO(r, "OWNER")), auto: true }
}
