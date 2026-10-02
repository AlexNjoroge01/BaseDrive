# Architecture

## Components

| Piece | Responsibility | Code |
|---|---|---|
| Next.js app | UI, API route handlers, server actions, auth | `app/`, `components/` |
| `proxy.ts` | Auth gating for app pages (JWT check only, no DB) | `proxy.ts`, `lib/auth.config.ts` |
| PostgreSQL | Metadata: users, items tree, uploads, grants, links, stars, jobs | `db/schema.ts` |
| Object storage | File bytes and thumbnails (`u/{ownerId}/{itemId}`, `t/{itemId}.webp`) | `lib/storage.ts` |
| Job runner | Thumbnails and storage purges | `lib/jobs/` |

Two deployment targets share one codebase. Only the caller of `processJobs()` differs: on Vercel, `after()` runs it after a response and Vercel Cron sweeps daily; on Kubernetes, a worker Deployment polls and a CronJob runs maintenance.

## Upload (resumable multipart)

1. `POST /api/uploads` checks the parent folder (edit role), the per-file limit, the owner's quota and the global cap, and resolves name clashes (`fail` → 409, `keepBoth` → "name (1).ext", `replace` → old file goes to trash). It creates an `UPLOADING` item plus an `uploads` row and calls `CreateMultipartUpload`.
2. `POST /api/uploads/:id/parts` presigns `UploadPart` URLs (5 min) in batches.
3. The browser PUTs 8 MB slices straight to the bucket, 3 at a time, retrying each 3× with backoff, and keeps the ETags. **Bucket CORS must expose `ETag`.**
4. Offline → paused. On `online`, `GET /api/uploads/:id` returns `ListParts`, and only missing parts are sent.
5. `POST /api/uploads/:id/complete` calls `CompleteMultipartUpload`, reads the real size with `HeadObject`, and in one transaction marks the item `READY`, adds the size to the owner's `storage_used`, and enqueues `THUMBNAIL` for images.

Abandoned uploads: the daily maintenance aborts uploads older than 24 h, and the bucket expires stale multipart uploads too.

## Data model notes

- **Materialized path.** `items.path = "/root/…/self/"`. Subtree = `path LIKE prefix%` (btree `text_pattern_ops` index). Ancestors are parsed from the string. A move updates the moved item's `parent_id`, then rewrites every descendant's path in a single `UPDATE … SET path = $new || substring(path from $n::int)`. The `::int` cast matters: without it Postgres picks the regex overload of `substring`.
- **Unique names per folder** via a partial unique index on `(owner_id, coalesce(parent_id,'root'), lower(name)) WHERE trashed_at IS NULL`.
- **Soft delete.** Trashing sets `trashed_at` on the item only. Anything under a trashed folder is hidden by a "no trashed ancestor" predicate on the path. Restore puts the item back, or at the root if its parent is gone, renaming on clash.
- **Delete forever** removes the subtree's rows and decrements quota in one transaction, then enqueues `PURGE_ITEM` with the storage keys. A slow bucket never holds the request.
- **Storage keys use ids, not names**, so rename and move never touch storage.

## Permissions

`resolveRole()` is a pure function: owner → `OWNER`; otherwise the highest grant on the item or any ancestor; otherwise a usable share link on the item or an ancestor (not revoked, not expired, password proven). `authorize()` loads the inputs, returns 404 if there's no role at all (no existence leak), and 403 if the role is too weak for the action.

| Action | Viewer | Editor | Owner |
|---|---|---|---|
| list / preview / download | ✓ | ✓ | ✓ |
| upload into, rename, move, trash, restore | | ✓ | ✓ |
| share, links, delete forever | | | ✓ |

Items created inside a shared folder belong to that folder's owner, who is charged quota for them. That keeps the unique-name index per drive and makes "who pays" unambiguous.

## Share links

`token = base64url(HMAC-SHA256(AUTH_SECRET, "share-link:" + linkId))`. The DB stores only `sha256(token)`. Because the token is derived, the owner can copy the same link again later, and a DB dump alone can't produce working links. A password-protected link sets an httpOnly cookie holding `HMAC(secret, linkId + passwordHash)` after a correct password. Changing the password invalidates old unlocks.

## Jobs

```sql
UPDATE jobs SET status='RUNNING', locked_at=now(), attempts=attempts+1
WHERE id = (SELECT id FROM jobs WHERE status='PENDING' AND run_at<=now()
            ORDER BY run_at FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING …
```

Failures go back to `PENDING` with exponential `run_at` backoff (10 s, 20 s, 40 s…) and become `FAILED` after 5 attempts. `RUNNING` jobs locked for more than 5 minutes are reclaimed by the sweeper.

## Security checklist

- CUID2 ids everywhere; unauthorized → 404.
- Presigned PUT 5 min, GET 60 s.
- Share tokens 32 bytes, stored hashed. Passwords (accounts and links) use bcrypt.
- Downloads are `attachment` unless the MIME type is allow-listed for inline preview. SVG/HTML are never inline, and text previews are served as `text/plain`.
- Size for quota comes from `HeadObject`.
- Names: control characters and slashes stripped, max 255.
- In-memory token-bucket rate limits on sign-in, sign-up, guest, link unlock, grants and upload start.
- Secrets only in env / k8s Secrets.
