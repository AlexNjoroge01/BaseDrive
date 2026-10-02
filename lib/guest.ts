import { and, eq, isNull } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import sharp from "sharp"
import { db } from "@/db"
import { items, users, type FolderColor } from "@/db/schema"
import { buildPath } from "@/lib/paths"
import { isUniqueViolation } from "@/lib/db-errors"
import { deleteObjects, objectKey, putObject, thumbnailKey } from "@/lib/storage"

export const GUEST_EMAIL = "guest@basedrive.demo"

export async function ensureGuestUser() {
  let guest = await db.query.users.findFirst({ where: eq(users.email, GUEST_EMAIL) })
  if (!guest) {
    ;[guest] = await db
      .insert(users)
      .values({ email: GUEST_EMAIL, name: "Guest", isGuest: true })
      .onConflictDoNothing()
      .returning()
    guest ??= await db.query.users.findFirst({ where: eq(users.email, GUEST_EMAIL) })
  }
  const any = await db.query.items.findFirst({
    where: and(eq(items.ownerId, guest!.id), isNull(items.trashedAt)),
  })
  if (!any) {
    try {
      await seedDemoDrive(guest!.id)
    } catch (err) {
      // Two first-time guests at once: the loser hits the unique name index.
      if (!isUniqueViolation(err)) throw err
    }
  }
  return guest!
}

/** Daily cron: wipe the guest drive and re-seed it. */
export async function resetGuest() {
  const guest = await db.query.users.findFirst({ where: eq(users.email, GUEST_EMAIL) })
  if (!guest) return
  const rows = await db
    .select({ key: items.storageKey, thumb: items.thumbnailKey })
    .from(items)
    .where(eq(items.ownerId, guest.id))
  await deleteObjects(rows.flatMap((r) => [r.key, r.thumb].filter((k): k is string => !!k)))
  await db.delete(items).where(eq(items.ownerId, guest.id))
  await db.update(users).set({ storageUsed: 0 }).where(eq(users.id, guest.id))
  await seedDemoDrive(guest.id)
}

/* ───────────────────────── demo content ───────────────────────── */

type SeedNode =
  | { type: "FOLDER"; name: string; children: SeedNode[]; color?: FolderColor; pin?: number }
  | { type: "FILE"; name: string; mime: string; body: () => Promise<Buffer> | Buffer; daysAgo?: number }

const text = (s: string) => () => Buffer.from(s.trim() + "\n", "utf8")

function svgArt(palette: string[], label: string, w = 1200, h = 800) {
  const bands = palette
    .map((c, i) => {
      const y = (h / palette.length) * i
      return `<rect x="0" y="${y}" width="${w}" height="${h / palette.length + 1}" fill="${c}"/>`
    })
    .join("")
  const circles = palette
    .map(
      (c, i) =>
        `<circle cx="${200 + i * 190}" cy="${h / 2 + (i % 2 ? 60 : -60)}" r="${120 - i * 8}" fill="${c}" opacity="0.9" stroke="#ffffff" stroke-width="6"/>`
    )
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${bands}${circles}
    <text x="60" y="${h - 60}" font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${label}</text>
  </svg>`
}

const png = (palette: string[], label: string) => async () =>
  sharp(Buffer.from(svgArt(palette, label))).png({ compressionLevel: 9 }).toBuffer()
const jpg = (palette: string[], label: string) => async () =>
  sharp(Buffer.from(svgArt(palette, label))).jpeg({ quality: 82 }).toBuffer()

const logoSvg = () =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#2B4ACB"/>
  <rect x="112" y="150" width="288" height="44" rx="10" fill="#E0B44A"/>
  <rect x="112" y="234" width="210" height="44" rx="10" fill="#6FA4E0"/>
  <rect x="112" y="318" width="150" height="44" rx="10" fill="#57BE8E"/>
</svg>`)

/** A tiny but valid single-page PDF. */
function pdf(title: string, lines: string[]) {
  return () => {
    const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
    const content = [
      "BT /F1 22 Tf 72 740 Td (" + esc(title) + ") Tj ET",
      ...lines.map((l, i) => `BT /F1 12 Tf 72 ${700 - i * 20} Td (${esc(l)}) Tj ET`),
    ].join("\n")
    const objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    let out = "%PDF-1.4\n"
    const offsets: number[] = []
    objs.forEach((o, i) => {
      offsets.push(Buffer.byteLength(out))
      out += `${i + 1} 0 obj\n${o}\nendobj\n`
    })
    const xref = Buffer.byteLength(out)
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(out, "latin1")
  }
}

const DEMO: SeedNode[] = [
  {
    type: "FOLDER",
    name: "Clients",
    color: "blue",
    pin: 4,
    children: [
      {
        type: "FOLDER",
        name: "Acme",
        color: "sun",
        children: [
          {
            type: "FILE",
            name: "Brief v3.pdf",
            mime: "application/pdf",
            daysAgo: 0,
            body: pdf("Acme: Project brief (v3)", [
              "Goal: relaunch the Acme customer portal by Q1.",
              "Scope: auth, billing history, document vault.",
              "Owner: Alex Njoroge",
              "Review: every Thursday, 14:00 EAT.",
            ]),
          },
          {
            type: "FILE",
            name: "Budget.csv",
            mime: "text/csv",
            daysAgo: 2,
            body: text(`
Line item,Q1,Q2,Q3,Q4
Design,4200,3800,2500,2500
Engineering,12800,14100,15200,13900
Infrastructure,640,710,820,900
Support,1500,1500,1800,2100`),
          },
          {
            type: "FILE",
            name: "Meeting notes.md",
            mime: "text/markdown",
            daysAgo: 4,
            body: text(`
# Acme kickoff

- Portal relaunch targets **Q1**.
- Billing history must export to CSV.
- Wanjiru owns the design review.

## Next steps
1. Share the brief with the client.
2. Draft the data model.
3. Book the Thursday review.`),
          },
        ],
      },
      { type: "FOLDER", name: "Globex", color: "aqua", children: [] },
    ],
  },
  {
    type: "FOLDER",
    name: "Brand assets",
    color: "coral",
    pin: 2,
    children: [
      { type: "FILE", name: "Logo-final.svg", mime: "image/svg+xml", daysAgo: 12, body: logoSvg },
      {
        type: "FILE",
        name: "Logo-final.png",
        mime: "image/png",
        daysAgo: 12,
        body: async () => sharp(logoSvg()).png().toBuffer(),
      },
      {
        type: "FILE",
        name: "Launch hero.jpg",
        mime: "image/jpeg",
        daysAgo: 6,
        body: jpg(["#2B4ACB", "#7A4FC9", "#B0367A", "#C25A1C"], "Launch week"),
      },
      {
        type: "FILE",
        name: "Palette study.png",
        mime: "image/png",
        daysAgo: 9,
        body: png(["#22805A", "#127A8C", "#2F6FB5", "#B8891A"], "Palette study"),
      },
      {
        type: "FILE",
        name: "Office wall.jpg",
        mime: "image/jpeg",
        daysAgo: 20,
        body: jpg(["#B8891A", "#6B5F4E", "#3D4B5C", "#16202A"], "Studio"),
      },
    ],
  },
  {
    type: "FOLDER",
    name: "Invoices",
    color: "mint",
    pin: 3,
    children: [
      {
        type: "FILE",
        name: "INV-0042.pdf",
        mime: "application/pdf",
        daysAgo: 30,
        body: pdf("Invoice INV-0042", ["Billed to: Acme Ltd", "Amount: KES 184,000", "Due: 30 days"]),
      },
      {
        type: "FILE",
        name: "INV-0043.pdf",
        mime: "application/pdf",
        daysAgo: 3,
        body: pdf("Invoice INV-0043", ["Billed to: Globex", "Amount: KES 96,500", "Due: 14 days"]),
      },
    ],
  },
  {
    type: "FOLDER",
    name: "Projects",
    color: "violet",
    pin: 1,
    children: [
      {
        type: "FILE",
        name: "basedrive.config.json",
        mime: "application/json",
        daysAgo: 1,
        body: text(
          JSON.stringify(
            {
              storage: { driver: "s3", partSize: "8MB", presignTtl: { put: 300, get: 60 } },
              jobs: { queue: "postgres", lock: "FOR UPDATE SKIP LOCKED" },
              quota: { perUser: "500MB", perFile: "100MB" },
            },
            null,
            2
          )
        ),
      },
      {
        type: "FILE",
        name: "upload.ts",
        mime: "text/typescript",
        daysAgo: 1,
        body: text(`
// Resumable multipart upload, client side (abridged)
export async function uploadParts(file: File, urls: string[], partSize: number) {
  const etags: string[] = []
  for (const [i, url] of urls.entries()) {
    const blob = file.slice(i * partSize, (i + 1) * partSize)
    const res = await fetch(url, { method: "PUT", body: blob })
    etags.push(res.headers.get("ETag")!) // needs ETag exposed in bucket CORS
  }
  return etags
}`),
      },
    ],
  },
  {
    type: "FILE",
    name: "Welcome to BaseDrive.md",
    mime: "text/markdown",
    daysAgo: 0,
    body: text(`
# Welcome to BaseDrive

This is a demo drive. It resets every day, so go ahead and break things.

**Try this:**
- Drag a file from your desktop onto this page.
- Right-click anything for actions, or press **F2** to rename.
- Press **⌘K** (or Ctrl K) to search.
- Share a folder and open the link in a private window.`),
  },
  {
    type: "FILE",
    name: "Roadmap.txt",
    mime: "text/plain",
    daysAgo: 5,
    body: text(`
Week 1: foundation (auth, storage, folders)
Week 2: multipart uploads, sharing, jobs
Week 3: kubernetes, CI, docs`),
  },
]

async function seedDemoDrive(ownerId: string) {
  let used = 0
  const walk = async (nodes: SeedNode[], parent: { id: string; path: string } | null) => {
    for (const node of nodes) {
      const id = createId()
      const path = buildPath(parent?.path ?? null, id)
      if (node.type === "FOLDER") {
        await db.insert(items).values({
          id,
          ownerId,
          parentId: parent?.id ?? null,
          type: "FOLDER",
          name: node.name,
          path,
          color: node.color ?? "blue",
          // Higher pin = more recently pinned = earlier on the shelf.
          pinnedAt: node.pin ? new Date(Date.now() - (10 - node.pin) * 60_000) : null,
        })
        await walk(node.children, { id, path })
        continue
      }
      const body = await node.body()
      const key = objectKey(ownerId, id)
      await putObject(key, body, node.mime)
      let thumb: string | null = null
      if (/^image\/(png|jpeg)$/.test(node.mime)) {
        thumb = thumbnailKey(id)
        const t = await sharp(body).resize(256, 256, { fit: "cover" }).webp({ quality: 78 }).toBuffer()
        await putObject(thumb, t, "image/webp")
      }
      const when = new Date(Date.now() - (node.daysAgo ?? 0) * 86_400_000 - Math.random() * 3_600_000)
      await db.insert(items).values({
        id,
        ownerId,
        parentId: parent?.id ?? null,
        type: "FILE",
        name: node.name,
        path,
        mimeType: node.mime,
        size: body.length,
        storageKey: key,
        thumbnailKey: thumb,
        status: "READY",
        createdAt: when,
        updatedAt: when,
      })
      used += body.length
    }
  }
  await walk(DEMO, null)
  await db.update(users).set({ storageUsed: used }).where(eq(users.id, ownerId))
}
