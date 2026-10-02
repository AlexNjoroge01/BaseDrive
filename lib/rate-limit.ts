import { headers } from "next/headers"
import { ApiError } from "@/lib/api"

/**
 * In-memory token bucket. Per instance, so it's a speed bump rather than a
 * wall on multi-replica deploys; enough for auth + upload start on a demo.
 */
type Bucket = { tokens: number; updated: number }
const buckets = new Map<string, Bucket>()

export function takeToken(key: string, capacity: number, refillPerMinute: number) {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: capacity, updated: now }
  const elapsed = (now - b.updated) / 60_000
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerMinute)
  b.updated = now
  if (b.tokens < 1) {
    buckets.set(key, b)
    return false
  }
  b.tokens -= 1
  buckets.set(key, b)
  if (buckets.size > 10_000) buckets.clear()
  return true
}

export async function clientIp() {
  const h = await headers()
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "local"
  )
}

export async function rateLimit(scope: string, capacity: number, perMinute: number, key?: string) {
  const id = key ?? (await clientIp())
  if (!takeToken(`${scope}:${id}`, capacity, perMinute)) {
    throw new ApiError("RATE_LIMITED", "Too many attempts. Wait a minute and try again.")
  }
}
