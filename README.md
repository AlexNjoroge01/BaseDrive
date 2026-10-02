# BaseDrive

A self-built cloud drive: upload files up to 100 MB, organise them in folders, preview, share with people or by link, and restore from trash. Built to show full-stack ownership of object storage, resumable uploads, tree-shaped permissions, background jobs, and a Kubernetes deploy.

**Live demo:** _add URL_ · **2-minute walkthrough:** _add Loom_ · Click **Try as guest**; the demo drive resets daily.

```
                ┌───────────────────────────────┐
  Browser ─────►│  Next.js (UI + API routes)    │──────► PostgreSQL
     │          │  auth · metadata · perms      │        items, uploads,
     │          │  signs presigned URLs         │        shares, jobs
     │          └───────────────────────────────┘              ▲
     │                                                         │ SKIP LOCKED
     │  PUT parts / GET file (presigned, direct)        ┌──────┴──────┐
     └─────────────────────────────────────────────────►│   Worker    │
                     Object storage (R2 / MinIO)  ◄─────│ thumbnails, │
                                                        │ purge       │
                                                        └─────────────┘
```

**The core rule:** file bytes never pass through Next.js. The server checks permissions and signs short-lived URLs; the browser talks to the bucket directly.

## What's interesting in here

| | Where |
|---|---|
| Resumable multipart uploads: 8 MB parts, 3 in parallel, 3 retries with backoff, pause offline, resume via `ListParts` | [lib/client/uploader.ts](lib/client/uploader.ts), [lib/uploads.ts](lib/uploads.ts) |
| Materialized-path folder tree; a move rewrites the whole subtree in one `UPDATE` | [lib/items.ts](lib/items.ts), [lib/paths.ts](lib/paths.ts) |
| Owner / editor / viewer roles inherited down the tree, plus expiring, password-protected links; unauthorized is **404** | [lib/permissions.ts](lib/permissions.ts) |
| Postgres as the job queue (`FOR UPDATE SKIP LOCKED`), backoff, stale-lock reclaim | [lib/jobs/queue.ts](lib/jobs/queue.ts) |
| Same job processor run by `after()` + Vercel Cron, or by a k8s worker Deployment + CronJob | [worker.ts](worker.ts), [app/api/cron/route.ts](app/api/cron/route.ts) |
| Share tokens derived with HMAC, stored only as SHA-256, so owners can re-copy a link without the DB holding it | [lib/tokens.ts](lib/tokens.ts) |
| Quota charged from `HeadObject`, never from the client's claimed size | [lib/uploads.ts](lib/uploads.ts) |

## Stack

Next.js 16 (App Router, `proxy.ts`, `after()`) · TypeScript strict · Tailwind v4 · shadcn/ui on Base UI · Framer Motion · TanStack Query · Zustand · React Hook Form + Zod · Drizzle ORM · PostgreSQL (Neon) · Auth.js v5 · S3 API (Cloudflare R2 / MinIO) · sharp · Resend · Vitest · Playwright · Docker · Kubernetes (k3d / k3s).

## Run it locally

Requires Node 22, pnpm, and Docker.

```bash
pnpm install
cp .env.example .env           # set AUTH_SECRET: openssl rand -base64 32
docker compose up -d --wait    # Postgres :5432, MinIO :9000 (console :9001)
pnpm db:migrate
pnpm dev                       # http://localhost:3000
pnpm worker                    # optional: k8s-style job worker (after() covers dev)
```

To use Neon instead of local Postgres, point `DATABASE_URL` at it (`DB_DRIVER=pg` works over TCP; `neon` uses the WebSocket pool for serverless).

## Run it on Kubernetes

```bash
make k8s-up      # k3d cluster → build web/worker/migrate images → import → apply overlays/local
open http://basedrive.localhost:8080
```

[k8s/base](k8s/base) holds the web Deployment (2 replicas, `/api/health` probes, migrate init container), the worker, a daily CronJob, and Postgres + MinIO StatefulSets. [k8s/overlays/oracle](k8s/overlays/oracle) targets k3s on Oracle's Always Free ARM nodes with cert-manager TLS; CI pushes multi-arch images to GHCR.

## Tests

```bash
pnpm test        # Vitest: permissions, paths, move-into-self, names, tokens, XSS guards
pnpm test:e2e    # Playwright: guest → upload → folder → move → share link → incognito → trash → restore
```

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs lint, typecheck, unit, migrations, build, and e2e against real Postgres + MinIO service containers, then pushes images on `main`.

## Docs

- [docs/architecture.md](docs/architecture.md): request flows, data model, jobs, security
- [docs/storage-setup.md](docs/storage-setup.md): R2 bucket CORS (the ETag gotcha) and lifecycle
- [docs/decisions](docs/decisions): ADRs for presigned URLs, materialized paths, Postgres-as-queue, R2 over Cloudinary/Neon storage, Drizzle over Prisma, and 404-not-403

## Scope

In: everything in [Blueprint.md](Blueprint.md) §1. Out, on purpose: sync client, real-time co-editing, version history, full-text search inside files, mobile app, payments.
