import { NextResponse } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { startUpload } from "@/lib/uploads"
import { startUploadSchema } from "@/lib/validation"
import { rateLimit } from "@/lib/rate-limit"

/** POST /api/uploads — check perms + quota, create item, start multipart. */
export const POST = route(async (req) => {
  const userId = await requireUserId()
  await rateLimit("upload-start", 60, 60, userId)
  const body = await readJson(req, startUploadSchema)
  return NextResponse.json(await startUpload(userId, body), { status: 201 })
})
