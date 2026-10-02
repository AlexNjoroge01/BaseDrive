import { NextResponse } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { createFolder } from "@/lib/items"
import { createFolderSchema } from "@/lib/validation"

export const POST = route(async (req) => {
  const userId = await requireUserId()
  const { name, parentId } = await readJson(req, createFolderSchema)
  return NextResponse.json({ item: await createFolder(userId, parentId, name) }, { status: 201 })
})
