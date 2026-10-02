# 5. Drizzle over Prisma

**Status:** accepted

## Context
This app leans on SQL Prisma makes awkward: subtree path rewrites, `FOR UPDATE SKIP LOCKED`, partial unique indexes, `text_pattern_ops` and `gin_trgm_ops` indexes, and `EXISTS` predicates on paths.

## Decision
Drizzle ORM with drizzle-kit migrations committed as SQL (`db/migrations/`). It runs `migrate` in CI/deploy and never `push` against prod.

## Consequences
- Schema is plain TypeScript; partial and expression indexes live in it.
- Queries read like SQL, and `sql\`\`` covers the rest with typed parameters.
- No codegen and no engine binary, so smaller images and painless ARM64 builds.
- One driver switch: Neon's WebSocket pool (interactive transactions) on serverless, `pg` elsewhere.
