import type { Metadata } from "next"
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { Clock, LinkIcon } from "lucide-react"
import { db } from "@/db"
import { items, users } from "@/db/schema"
import { resolveLink } from "@/lib/sharing"
import { isUnlocked } from "@/lib/public-link"
import { itemSelect, toDTO } from "@/lib/items"
import { pathIds } from "@/lib/paths"
import { idSchema } from "@/lib/validation"
import { PublicShell, PublicMessage } from "./public-shell"
import { PasswordGate } from "./password-gate"
import { PublicView } from "./public-view"
import type { Crumb } from "@/lib/types"

export const metadata: Metadata = {
  title: "Shared with you",
  robots: { index: false, follow: false },
}

export default async function SharePage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params
  const sp = await props.searchParams
  const first = await resolveLink(token, false)
  const unlocked = first.state === "locked" ? await isUnlocked(first.link) : true
  const res = first.state === "locked" && unlocked ? await resolveLink(token, true) : first

  if (res.state === "invalid") {
    return (
      <PublicShell>
        <PublicMessage
          icon={<LinkIcon className="size-6" />}
          title="This link doesn't work."
          body="It may have been turned off, or the item was deleted. Ask the owner for a new one."
        />
      </PublicShell>
    )
  }
  if (res.state === "expired") {
    return (
      <PublicShell>
        <PublicMessage
          icon={<Clock className="size-6" />}
          title="This link has expired."
          body="Ask the owner for a new one."
        />
      </PublicShell>
    )
  }
  if (res.state === "locked") {
    return (
      <PublicShell sharer={res.sharer}>
        <PasswordGate token={token} />
      </PublicShell>
    )
  }

  const { item: root, sharer, link } = res
  const rootRow = (
    await db.select(itemSelect(null)).from(items).innerJoin(users, eq(users.id, items.ownerId)).where(eq(items.id, root.id))
  )[0]
  const rootDTO = toDTO(rootRow, link.role)

  if (root.type === "FILE") {
    return (
      <PublicShell sharer={sharer} title={root.name} download={`/api/s/${token}/items/${root.id}/download`}>
        <PublicView token={token} file={rootDTO} />
      </PublicShell>
    )
  }

  // Folder: browse within the shared subtree via ?f=
  const requested = typeof sp.f === "string" && idSchema.safeParse(sp.f).success ? sp.f : root.id
  let current = root
  if (requested !== root.id) {
    const sub = await db.query.items.findFirst({ where: eq(items.id, requested) })
    if (sub && sub.type === "FOLDER" && sub.path.startsWith(root.path) && !sub.trashedAt) current = sub
  }

  const chain = pathIds(current.path).slice(pathIds(root.path).length - 1)
  const names = await db.select({ id: items.id, name: items.name }).from(items).where(inArray(items.id, chain))
  const byId = new Map(names.map((n) => [n.id, n.name]))
  const crumbs: Crumb[] = chain.map((id) => ({
    id,
    name: byId.get(id) ?? "…",
    href: id === root.id ? `/s/${token}` : `/s/${token}?f=${id}`,
  }))

  const rows = await db
    .select(itemSelect(null))
    .from(items)
    .innerJoin(users, eq(users.id, items.ownerId))
    .where(and(eq(items.parentId, current.id), isNull(items.trashedAt), eq(items.status, "READY")))
    .orderBy(desc(sql`${items.type} = 'FOLDER'`), asc(sql`lower(${items.name})`))

  return (
    <PublicShell sharer={sharer} title={byId.get(current.id) ?? current.name}>
      <PublicView
        token={token}
        folder={{
          name: byId.get(current.id) ?? current.name,
          crumbs,
          items: rows.map((r) => ({ ...toDTO(r, link.role), shared: false, starred: false })),
        }}
      />
    </PublicShell>
  )
}
