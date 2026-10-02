import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

function secret() {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error("AUTH_SECRET is not set")
  return s
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

/**
 * Share-link token = HMAC(AUTH_SECRET, linkId), 32 bytes, base64url.
 * Only its SHA-256 is stored. Because the token is derived rather than
 * random-and-forgotten, the owner can copy the same link again later
 * without the database ever holding a usable token.
 */
export function linkToken(linkId: string) {
  return createHmac("sha256", secret())
    .update(`share-link:${linkId}`)
    .digest("base64url")
}

export function hashToken(token: string) {
  return sha256(token)
}

/** Proof that a visitor entered a link's password; stored in a cookie. */
export function linkUnlockProof(linkId: string, passwordHash: string) {
  return createHmac("sha256", secret())
    .update(`unlock:${linkId}:${passwordHash}`)
    .digest("base64url")
}

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url")
}

export const unlockCookieName = (linkId: string) => `bd_link_${linkId}`
