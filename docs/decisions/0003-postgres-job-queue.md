# 3. Postgres as the job queue

**Status:** accepted

## Context
Background work is light: thumbnails and storage purges, plus a daily sweep. Running Redis/BullMQ adds a service, a free tier to stay inside, and another thing to deploy on k8s.

## Decision
A `jobs` table, claimed with `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`. Exponential backoff on failure, `FAILED` after 5 attempts, and stale `RUNNING` rows reclaimed after 5 minutes. Jobs are enqueued in the *same transaction* as the change that needs them (e.g. upload completion), so no job is ever lost or orphaned.

## Consequences
- Exactly-once claim across any number of workers, transactional enqueue, zero extra infra.
- Polling latency (2 s idle sleep on k8s; on Vercel, `after()` runs the queue right after the response).
- Revisit if throughput reaches thousands of jobs per second or needs fan-out/pub-sub. At that point use a real broker (SQS, Redis Streams, NATS).
