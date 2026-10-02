import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { HeadBucketCommand } from "@aws-sdk/client-s3"
import { db } from "@/db"
import { BUCKET, s3 } from "@/lib/storage"
import { describeStorageError } from "@/lib/api"

export const dynamic = "force-dynamic"

/** Liveness/readiness for k8s; also the quickest way to check a deploy's config. */
export async function GET() {
  const [dbResult, storageResult] = await Promise.allSettled([
    db.execute(sql`select 1`),
    s3.send(new HeadBucketCommand({ Bucket: BUCKET })),
  ])
  const dbUp = dbResult.status === "fulfilled"
  const storageUp = storageResult.status === "fulfilled"
  // Status follows the DB only, so k8s doesn't restart pods over a storage
  // outage; the body still says what's wrong with storage.
  const body = {
    ok: dbUp,
    db: dbUp ? "up" : "down",
    storage: storageUp
      ? "up"
      : (describeStorageError((storageResult as PromiseRejectedResult).reason) ?? "down"),
  }
  return NextResponse.json(body, { status: body.ok ? 200 : 503 })
}
