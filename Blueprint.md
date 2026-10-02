# BaseDrive — MVP Blueprint

> A self-built cloud file storage app (Google Drive–style). Built as a portfolio project to demonstrate full-stack ownership: object storage, large-file uploads, permissions, background jobs, and Kubernetes deployment.

**Owner:** Alex Njoroge
**Timebox:** 3 weeks. Anything not listed under "MVP scope" is out.
**Budget:** KES 0. Every service below has a free tier.

---

## 1. Goals

### Product goals
- Users can sign up, upload files (up to 100 MB each), organize them in folders, preview, download, rename, move, trash/restore, and share.
- A recruiter can open the live demo and use it in under 30 seconds with a **guest login**.

### Learning / portfolio goals (what this proves)
| Skill | Where it shows up |
|---|---|
| Object storage | Presigned URLs, bucket CORS, no file bytes through the API |
| Large file handling | S3 multipart, resumable uploads, retries |
| Data modeling | Folder tree with materialized paths, partial unique indexes |
| Authorization | Owner / editor / viewer roles inherited down the folder tree, expiring share links |
| Background jobs | Postgres-backed job queue (`FOR UPDATE SKIP LOCKED`), thumbnail generation, trash purge |
| Infra | Same app runs on Vercel *and* Kubernetes (k3d locally, k3s on Oracle Always Free) |
| Engineering hygiene | Typed end to end, tests, CI/CD, architecture docs |

### Non-goals (do not build)
Desktop sync client · real-time collaborative editing · file version history · full-text search inside documents · mobile app · payments.

---

## 2. Tech Stack

Standard stack, with two deliberate deviations: **Drizzle instead of Prisma**, and **R2 instead of Cloudinary** for files.

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16.3.8** (App Router, full stack, Turbopack) | Route handlers for API, server actions for mutations, `after()` for post-response work, `proxy.ts` (Next 16's replacement for `middleware.ts`) for auth gating |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS | |
| UI Components | shadcn/ui | DataTable, ContextMenu, Dialog, DropdownMenu, Breadcrumb |
| Icons | Lucide React | File-type icons |
| Animations | Framer Motion | Upload panel, drag-and-drop feedback |
| Forms & Validation | React Hook Form + Zod | Zod schemas shared by client and server |
| ORM | **Drizzle ORM** + drizzle-kit | Schema in TypeScript, SQL-first, partial indexes in schema, no client codegen, small bundle |
| DB driver | `@neondatabase/serverless` (Pool, WebSocket) on Vercel · `pg` on k8s/local | Pool driver, not `neon-http`, because uploads/moves/purges need interactive transactions |
| Database | PostgreSQL | Neon (free) in prod, Postgres container on k8s/local |
| Auth | NextAuth.js v5 (Auth.js) + `@auth/drizzle-adapter` | Credentials + GitHub OAuth, JWT sessions |
| Client state | Zustand | Upload queue, selection, view mode |
| Server state | TanStack React Query | Folder listings, optimistic rename/move |
| UI notifications | Sonner | Upload done/failed, share link copied |
| Email | Resend + React Email | "X shared a folder with you" |
| **File storage** | **S3-compatible object storage** — **Cloudflare R2** (prod) / **MinIO** (local + k8s) | **Deviation from Cloudinary**, see below |
| Image processing | `sharp` | Thumbnails (runs in worker) |
| Cron | Vercel Cron | Daily: purge trash > 30 days, reset guest account |
| Testing | Vitest + Playwright | |
| CI/CD | GitHub Actions + GHCR | |

### Why not Cloudinary for files
Cloudinary is a media pipeline (transform and deliver images/video). A Drive stores arbitrary files (PDFs, zips, code) and the core skill being demonstrated is owning object storage: presigned URLs, multipart uploads, bucket policy. Using the S3 API also means one code path works for R2, MinIO, and AWS S3 via a single `S3_ENDPOINT` env var.

### Why not Neon Object Storage (considered, rejected)
Attractive: S3-compatible, branches with the database, object-created triggers for thumbnails. Rejected for this app on the free plan because:
- Only 5 GB per project, and downloads count against the **same 5 GB/month network transfer as the database**. Exceeding it suspends the database until the next period. A file app is download-heavy; one busy demo day could take the whole app offline.
- Regions are US East / Frankfurt / Singapore only.
- R2: 10 GB free, **$0 egress**, independent of the database.

Revisit if the project moves to a paid Neon plan. (Write this up as an ADR.)

### Why Drizzle over Prisma
- Schema is plain TypeScript; queries read like SQL, which this app leans on heavily (path prefix updates, `SKIP LOCKED`, recursive permission checks).
- Partial unique indexes and custom index operators (`text_pattern_ops`, `gin_trgm_ops`) expressible in the schema.
- No codegen step or engine binary: smaller Docker image, simpler multi-arch (ARM64) builds.

---

## 3. Free-Tier Budget

| Need | Service | Free allowance (verify before launch) | How we stay inside it |
|---|---|---|---|
| App hosting | Vercel Hobby | Free, non-commercial | Portfolio = non-commercial |
| Database | Neon Free | 1 GB Postgres storage/project, 100 CU-hours/project, 5 GB egress, scale-to-zero after 5 min | Metadata only, no blobs |
| Object storage | Cloudflare R2 | 10 GB storage, 1M Class A + 10M Class B ops/month, $0 egress | Global cap 8 GB, 500 MB per user, 100 MB per file |
| Email | Resend | Free tier (~100/day) | Only share notifications |
| Kubernetes (local) | k3d / kind | Free | Dev + demo of manifests |
| Kubernetes (cloud) | Oracle Cloud Always Free Ampere A1 | 2 OCPU / 12 GB RAM (ARM64) | Single-node k3s; multi-arch images |
| Container registry | GitHub Container Registry | Free for public images | |
| CI | GitHub Actions | Free for public repos | |

Redis is intentionally **not** used. The job queue runs on Postgres. One fewer service, and a good interview talking point.

---

## 4. Architecture

```
                ┌───────────────────────────────┐
  Browser ─────►│  Next.js (UI + API routes)    │──────► PostgreSQL
     │          │  - auth, metadata, perms      │        (items, uploads,
     │          │  - signs presigned URLs       │         shares, jobs)
     │          └───────────────────────────────┘              ▲
     │                                                         │ poll jobs
     │  PUT parts / GET file (presigned, direct)        ┌──────┴──────┐
     └──────────────────────────────────────────────►   │   Worker    │
                     Object storage (R2 / MinIO)  ◄─────│ thumbnails, │
                                                        │ purge       │
                                                        └─────────────┘
```

**Core rule:** file bytes never pass through Next.js. The server only authorizes and signs URLs. The browser talks to storage directly.

### Two deployment targets, one codebase
| | Vercel target | Kubernetes target |
|---|---|---|
| Web | Vercel | `web` Deployment (2 replicas) |
| DB | Neon | Postgres StatefulSet (or Neon) |
| Storage | Cloudflare R2 | MinIO StatefulSet + PVC |
| Jobs | `after()` triggers processing post-response; Vercel Cron as sweeper | Dedicated `worker` Deployment polling the jobs table |
| Cron | Vercel Cron | k8s `CronJob` |

The job processor is one function (`processJobs()`). Only the *runtime that calls it* differs per target.

---

## 5. Data Model (Drizzle)

`db/schema.ts`
```ts
import {
  pgTable, pgEnum, text, bigint, integer, boolean, timestamp, jsonb,
  index, uniqueIndex, type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const itemType   = pgEnum("item_type",   ["FILE", "FOLDER"]);
export const itemStatus = pgEnum("item_status", ["UPLOADING", "READY", "FAILED"]);
export const role       = pgEnum("role",        ["VIEWER", "EDITOR"]);
export const jobType    = pgEnum("job_type",    ["THUMBNAIL", "PURGE_ITEM"]);
export const jobStatus  = pgEnum("job_status",  ["PENDING", "RUNNING", "DONE", "FAILED"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  passwordHash: text("password_hash"),
  storageUsed: bigint("storage_used", { mode: "number" }).default(0).notNull(),
  storageQuota: bigint("storage_quota", { mode: "number" }).default(524_288_000).notNull(), // 500 MB
  isGuest: boolean("is_guest").default(false).notNull(),
  createdAt: createdAt(),
});
// + accounts / sessions / verificationTokens tables from @auth/drizzle-adapter

export const items = pgTable("items", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => items.id), // null = root
  type: itemType("type").notNull(),
  name: text("name").notNull(),
  path: text("path").notNull(), // materialized: "/rootId/.../thisId/"
  mimeType: text("mime_type"),
  size: bigint("size", { mode: "number" }).default(0).notNull(),
  storageKey: text("storage_key").unique(), // "u/{ownerId}/{itemId}"
  thumbnailKey: text("thumbnail_key"),
  status: itemStatus("status").default("READY").notNull(),
  trashedAt: timestamp("trashed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
    .$onUpdate(() => new Date()),
}, (t) => [
  index("items_owner_parent_idx").on(t.ownerId, t.parentId),
  index("items_path_prefix_idx").using("btree", sql`${t.path} text_pattern_ops`),
  index("items_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`), // search
  // No duplicate names in the same folder, ignoring trashed items
  uniqueIndex("items_unique_name_in_folder")
    .on(t.ownerId, sql`coalesce(${t.parentId}, 'root')`, sql`lower(${t.name})`)
    .where(sql`${t.trashedAt} is null`),
]);

export const uploads = pgTable("uploads", {
  id: id(),
  itemId: text("item_id").notNull().unique().references(() => items.id, { onDelete: "cascade" }),
  s3UploadId: text("s3_upload_id").notNull(),
  partSize: integer("part_size").notNull(), // 8 MB
  totalParts: integer("total_parts").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const shareGrants = pgTable("share_grants", { // share with a specific user
  id: id(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: role("role").notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex("share_grants_item_user").on(t.itemId, t.userId)]);

export const shareLinks = pgTable("share_links", { // public link
  id: id(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(), // SHA-256 of token, never the token
  role: role("role").default("VIEWER").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const jobs = pgTable("jobs", {
  id: id(),
  type: jobType("type").notNull(),
  payload: jsonb("payload").notNull(),
  status: jobStatus("status").default("PENDING").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  error: text("error"),
  createdAt: createdAt(),
}, (t) => [index("jobs_status_run_at_idx").on(t.status, t.runAt)]);
```

Relations (`relations()` helpers for `db.query.*`) live in `db/relations.ts`.

### Migrations
- `drizzle-kit generate` → SQL files committed in `db/migrations/` (reviewable in PRs).
- `drizzle-kit migrate` in CI/deploy. **Never `drizzle-kit push` against prod.**
- First migration is a custom one (`drizzle-kit generate --custom`): `CREATE EXTENSION IF NOT EXISTS pg_trgm;`. Neon supports `pg_trgm`.
- After generating, read the SQL and confirm the partial unique index and `text_pattern_ops` index came out as intended; hand-edit the migration if not.

### DB client (`db/index.ts`)
```ts
import * as schema from "./schema";
// Vercel/Neon: WebSocket Pool (supports interactive transactions)
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
// k8s/local: node-postgres
import { Pool as PgPool } from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";

export const db = process.env.DB_DRIVER === "neon"
  ? drizzleNeon(new Pool({ connectionString: process.env.DATABASE_URL }), { schema })
  : drizzlePg(new PgPool({ connectionString: process.env.DATABASE_URL }), { schema });
```

### Key decisions
- **Materialized path** over adjacency-only: subtree queries (`path LIKE '/a/b/%'`) and ancestor checks are one query. Cost: a move rewrites descendant paths in one `UPDATE ... SET path = replace(...)` inside a transaction.
- **Storage key is based on item ID, not name.** Rename and move are metadata-only. Zero storage ops.
- **Soft delete (`trashedAt`).** Trashing a folder sets `trashedAt` on the folder only; children are hidden because listings filter by "no trashed ancestor" using the path.
- **Quota is updated transactionally** on upload completion and on purge.

---

## 6. Permissions Model

Effective role for user `U` on item `I`:
1. `U` owns `I` → **OWNER**
2. Else the highest `ShareGrant` for `U` on `I` **or any ancestor** (ancestor IDs parsed from `I.path`) → **EDITOR / VIEWER**
3. Else valid `ShareLink` token presented (not expired, not revoked, password ok) on `I` or an ancestor → link's role
4. Else → **404** (not 403, don't leak existence)

| Action | Viewer | Editor | Owner |
|---|---|---|---|
| List / preview / download | ✅ | ✅ | ✅ |
| Upload into folder, rename, move within shared tree | | ✅ | ✅ |
| Trash / restore | | ✅ | ✅ |
| Share, create links, delete forever | | | ✅ |

Implemented once in `lib/permissions.ts` → `getEffectiveRole(userId, itemId, linkToken?)`. Every route handler calls it. **This file gets the most unit tests.**

---

## 7. Upload Flow (Resumable Multipart)

```
Client                         Next.js API                     Storage
  │ POST /api/uploads            │                                │
  │ {name,size,mime,parentId} ──►│ check perms + quota            │
  │                              │ create Item(UPLOADING)          │
  │                              │ CreateMultipartUpload ────────►│
  │◄── {uploadId, partSize, n} ──│ save Upload row                │
  │                                                               │
  │ POST /api/uploads/:id/parts {partNumbers:[1..k]}              │
  │◄── presigned PUT URLs (5 min) ─                               │
  │ PUT part bytes ──────────────────────────────────────────────►│
  │   (3 parts in parallel, retry each 3x w/ backoff, keep ETags) │
  │                                                               │
  │ POST /api/uploads/:id/complete {parts:[{n,etag}]} ──►│         │
  │                              │ CompleteMultipartUpload ──────►│
  │                              │ Item → READY, quota += size     │
  │                              │ enqueue THUMBNAIL job           │
```

- **Resume:** client keeps `uploadId` in Zustand. On reconnect, `GET /api/uploads/:id` calls `ListParts` and returns completed part numbers; client uploads only the missing ones.
- **Files < 8 MB:** same flow with 1 part. One code path.
- **Abandoned uploads:** daily cron aborts multipart uploads older than 24 h and deletes the `UPLOADING` item. Also set a bucket lifecycle rule to abort incomplete multipart uploads after 1 day (belt and braces).
- **Bucket CORS** must allow `PUT` from the app origin and **expose the `ETag` header**, otherwise the browser can't read ETags. This is the #1 thing that breaks.

### Download / preview
`GET /api/items/:id/download` → perms check → 302 to presigned GET (60 s) with `ResponseContentDisposition: attachment; filename="..."`. Previews (images, PDFs, video, text) use `inline` disposition and render in a dialog.

---

## 8. Background Jobs

Postgres as queue (run via Drizzle's `db.execute(sql`...`)`):
```sql
UPDATE jobs SET status = 'RUNNING', locked_at = now(), attempts = attempts + 1
WHERE id = (
  SELECT id FROM jobs
  WHERE status = 'PENDING' AND run_at <= now()
  ORDER BY run_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
) RETURNING *;
```
- Failed → back to `PENDING` with exponential `runAt` backoff, `FAILED` after 5 attempts.
- Stale `RUNNING` (> 5 min) reclaimed by sweeper.

| Job | What it does |
|---|---|
| `THUMBNAIL` | Images only: download object, `sharp` → 256 px WebP, upload to `t/{itemId}.webp`, set `thumbnailKey` |
| `PURGE_ITEM` | Delete object + thumbnail from storage, delete rows, decrement quota |

| Cron (daily) | What it does |
|---|---|
| Trash purge | Enqueue `PURGE_ITEM` for items trashed > 30 days |
| Upload cleanup | Abort stale multipart uploads |
| Guest reset | Wipe guest account, re-seed demo folder |

---

## 9. API Surface

All routes: Zod-validated input, `getEffectiveRole` check, consistent error shape `{ error: { code, message } }`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/items?parentId=` | List folder (excludes trashed) |
| GET | `/api/items/:id` | Item metadata + breadcrumbs |
| POST | `/api/folders` | Create folder |
| PATCH | `/api/items/:id` | Rename / move (`{name?, parentId?}`) — reject moving into own subtree |
| POST | `/api/items/:id/trash` · `/restore` | Soft delete / restore |
| DELETE | `/api/items/:id` | Delete forever (enqueue purge) |
| GET | `/api/items/:id/download` | Presigned GET redirect |
| GET | `/api/trash` | List trashed |
| GET | `/api/search?q=` | Name search (ILIKE + trigram index) |
| POST | `/api/uploads` | Start upload |
| POST | `/api/uploads/:id/parts` | Presign part URLs |
| GET | `/api/uploads/:id` | Resume info (ListParts) |
| POST | `/api/uploads/:id/complete` | Complete upload |
| DELETE | `/api/uploads/:id` | Abort upload |
| POST | `/api/items/:id/grants` | Share with user by email (+ Resend email) |
| DELETE | `/api/items/:id/grants/:userId` | Revoke |
| POST | `/api/items/:id/links` | Create link (`{role, expiresAt?, password?}`) |
| DELETE | `/api/links/:id` | Revoke link |
| GET | `/s/:token` | Public share page |
| GET | `/api/me/usage` | Storage used / quota |
| GET | `/api/health` | Liveness/readiness for k8s |

---

## 10. UI

| Screen | Contents |
|---|---|
| `/login`, `/signup` | Credentials, GitHub, **"Try as guest"** button |
| `/drive/[[...folderId]]` | Breadcrumbs, grid/list toggle, sort, drag-and-drop upload zone, right-click context menu, multi-select |
| `/shared` | Items shared with me |
| `/trash` | Restore / delete forever |
| `/s/[token]` | Public view: file preview or folder listing, password prompt if set |
| Global | Upload panel (bottom-right, per-file progress, retry, cancel), storage usage bar in sidebar, `⌘K` search |

Auth gating in `proxy.ts`. Optimistic updates via React Query for rename/move/trash. Keyboard: `Del` trash, `F2` rename, `Enter` open.

---

## 11. Security Checklist
- [ ] All IDs are CUIDs; unauthorized = 404
- [ ] Presigned URLs short-lived (PUT 5 min, GET 60 s)
- [ ] Share tokens: 32 random bytes, stored hashed
- [ ] Passwords: bcrypt/argon2; link passwords too
- [ ] Downloads forced `attachment` except allow-listed preview MIME types (prevents stored XSS via uploaded HTML/SVG)
- [ ] Server re-checks `size` from `HeadObject` on complete (don't trust client size for quota)
- [ ] File name sanitization (no `/`, control chars, max 255)
- [ ] Rate limit auth + upload start endpoints (simple Postgres or in-memory token bucket)
- [ ] Secrets only in env / k8s Secrets, never committed

---

## 12. Kubernetes

```
k8s/
  base/
    namespace.yaml
    web-deployment.yaml       # 2 replicas, readiness /api/health
    web-service.yaml
    worker-deployment.yaml    # 1 replica, runs `node worker.js`
    cronjob-maintenance.yaml  # daily
    minio-statefulset.yaml    # + PVC 20Gi
    postgres-statefulset.yaml # + PVC 5Gi
    ingress.yaml              # Traefik (k3s default)
    configmap.yaml
    kustomization.yaml
  overlays/
    local/    # k3d, self-signed TLS, small resource limits
    oracle/   # k3s on Ampere A1 (ARM64), cert-manager + Let's Encrypt
```

- One image, two entrypoints (`web`, `worker`). Built with `docker buildx --platform linux/amd64,linux/arm64` (Oracle is ARM).
- Resource requests sized to fit 2 OCPU / 12 GB total with headroom.
- `minio-init` Job creates the bucket, CORS, and lifecycle rule on first deploy.
- `drizzle-kit migrate` runs as an init container on `web` (dedicated `migrate` image target).

**Local in one command:** `make k8s-up` → creates k3d cluster, builds image, imports it, applies `overlays/local`.

---

## 13. Project Structure

```
basedrive/
  app/
    (auth)/login, signup
    (drive)/drive/[[...folderId]], shared, trash
    s/[token]/
    api/...
  components/
    drive/       # FileGrid, FileRow, Breadcrumbs, ContextMenu, PreviewDialog
    upload/      # UploadZone, UploadPanel
    share/       # ShareDialog, LinkSettings
    ui/          # shadcn
  lib/
    auth.ts
    storage.ts       # S3 client, presign helpers
    permissions.ts
    paths.ts         # materialized path helpers
    jobs/            # queue.ts, processors/thumbnail.ts, processors/purge.ts
    validation/      # Zod schemas
  stores/            # Zustand: upload-store.ts, selection-store.ts
  worker.ts          # k8s worker entrypoint
  db/                # schema.ts, relations.ts, index.ts, migrations/
  drizzle.config.ts
  k8s/
  tests/
    unit/            # permissions, paths, quota
    e2e/             # Playwright
  docker-compose.yml # Postgres + MinIO for dev
  Dockerfile
  .github/workflows/ci.yml
  docs/
    architecture.md
    decisions/       # ADRs
```

### Environment variables
```
DATABASE_URL=
DB_DRIVER=              # neon | pg
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
S3_ENDPOINT=            # https://<acct>.r2.cloudflarestorage.com | http://minio:9000
S3_REGION=auto
S3_BUCKET=basedrive
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=    # true for MinIO
RESEND_API_KEY=
APP_URL=
CRON_SECRET=
MAX_FILE_BYTES=104857600
GLOBAL_STORAGE_CAP_BYTES=8589934592
```

---

## 14. Testing & CI

| Layer | Tool | Must cover |
|---|---|---|
| Unit | Vitest | `getEffectiveRole` (owner, inherited grant, link, expired link, revoked), move-into-self rejection, path rewrite, quota math |
| Integration | Vitest + docker-compose (Postgres, MinIO) | Full multipart upload, resume after partial parts, complete → thumbnail job |
| E2E | Playwright | Guest login → upload → create folder → move → share link → open in incognito → trash → restore |

**CI (`ci.yml`)** on PR: install → lint → typecheck → unit → integration (services: postgres, minio) → e2e → build.
On `main`: + multi-arch image push to GHCR → Vercel deploys automatically.

---

## 15. Timeline

### Week 1 — Foundation
| Day | Deliverable |
|---|---|
| 1 | Repo, Next.js 16.3.8 + Tailwind + shadcn, docker-compose (Postgres, MinIO), Drizzle schema + first migration |
| 2 | Auth.js v5 (credentials, GitHub, guest), protected layout |
| 3 | `storage.ts`, single-part upload + presigned download, bucket CORS |
| 4 | Folder CRUD, materialized paths, breadcrumbs, list/grid view |
| 5 | Rename, move (with subtree path rewrite), trash/restore, `paths.ts` unit tests |
| 6–7 | Buffer + deploy v0 to Vercel/Neon/R2 |

### Week 2 — The hard parts
| Day | Deliverable |
|---|---|
| 8–9 | Multipart upload, parallel parts, retries, upload panel |
| 10 | Resume via ListParts, abort, stale upload cleanup |
| 11 | Permissions module + full unit tests; ShareGrant + email |
| 12 | ShareLinks (expiry, password), public `/s/[token]` page |
| 13 | Postgres job queue, thumbnail processor, previews |
| 14 | Quotas, usage bar, search, crons |

### Week 3 — Ship it
| Day | Deliverable |
|---|---|
| 15–16 | Dockerfile, worker entrypoint, k8s base + local overlay, `make k8s-up` |
| 17 | Oracle k3s deploy (optional, if capacity is available) |
| 18 | Playwright e2e + CI pipeline green |
| 19 | README, architecture diagram, 3–5 ADRs |
| 20 | Loom demo (2 min), blog post: *"Building resumable uploads with S3 multipart and presigned URLs"* |
| 21 | Buffer. **Then stop.** |

---

## 16. Definition of Done (portfolio-ready)
- [ ] Live URL with working **"Try as guest"**
- [ ] README: what it is, 1 diagram, stack, how to run locally (`docker compose up` + `pnpm dev`) and on k8s (`make k8s-up`)
- [ ] `docs/decisions/` ADRs: presigned URLs, materialized paths, Postgres-as-queue, R2 over Cloudinary and Neon Object Storage, Drizzle over Prisma, 404-not-403
- [ ] CI badge green, tests for permissions and uploads
- [ ] 2-minute Loom linked at top of README
- [ ] One technical blog post published and linked
- [ ] Added to portfolio site with a 3-line summary + links

## 17. Interview Talking Points
1. Why the server never touches file bytes, and what presigned URLs trade off.
2. How resumable uploads work and the ETag/CORS gotcha.
3. Materialized path vs adjacency list vs closure table, and what a move costs.
4. Permission inheritance down a tree and why unauthorized returns 404.
5. Postgres as a job queue with `SKIP LOCKED`: when it's enough, when you'd switch to a real broker.
6. Running the same app on serverless (Vercel) and Kubernetes, and what changes (job runtime, cron).

## 18. Stretch (only after Definition of Done)
File version history · content-hash deduplication · activity log · zip download of a folder · PDF text search · Prometheus metrics + Grafana on k8s.