import { NextResponse, after } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import {
  deleteForever,
  getItemDetails,
  getItemRow,
  moveItems,
  renameItem,
  toDTO,
  updateFolderLook,
} from "@/lib/items"
import { idSchema, updateItemSchema } from "@/lib/validation"
import { processJobs } from "@/lib/jobs/queue"

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/items/:id — metadata + breadcrumbs. */
export const GET = route(async (_req, { params }: Ctx) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  return NextResponse.json(await getItemDetails(userId, id))
})

/** PATCH /api/items/:id — rename, move, folder colour, pin (`{ name?, parentId?, color?, pinned? }`). */
export const PATCH = route(async (req, { params }: Ctx) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const body = await readJson(req, updateItemSchema)
  if (body.parentId !== undefined) await moveItems(userId, [id], body.parentId)
  if (body.color !== undefined || body.pinned !== undefined) {
    const item = await updateFolderLook(userId, id, { color: body.color, pinned: body.pinned })
    if (body.name === undefined) return NextResponse.json({ item })
  }
  if (body.name !== undefined) {
    return NextResponse.json({ item: await renameItem(userId, id, body.name) })
  }
  const row = await getItemRow(id, userId)
  return NextResponse.json({ item: toDTO(row!) })
})

/** DELETE /api/items/:id — delete forever (bytes purged by a job). */
export const DELETE = route(async (_req, { params }: Ctx) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const res = await deleteForever(userId, [id])
  after(() => processJobs())
  return NextResponse.json(res)
})
