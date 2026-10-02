import { NextResponse, after } from "next/server"
import { route, requireUserId, readJson } from "@/lib/api"
import { completeUpload } from "@/lib/uploads"
import { completeUploadSchema, idSchema } from "@/lib/validation"
import { processJobs } from "@/lib/jobs/queue"

/** POST /api/uploads/:id/complete — CompleteMultipartUpload, READY, quota += size. */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const userId = await requireUserId()
  const id = idSchema.parse((await params).id)
  const { parts } = await readJson(req, completeUploadSchema)
  const { item, needsProcessing } = await completeUpload(userId, id, parts)
  // Vercel target: run the thumbnail job right after the response.
  // On k8s the worker would pick it up anyway; this just makes it snappier.
  if (needsProcessing) after(() => processJobs({ max: 5 }))
  return NextResponse.json({ item })
})
