# 1. Presigned URLs: file bytes never touch the app

**Status:** accepted

## Context
A drive moves large files. Proxying them through Next.js would tie up serverless functions (Vercel caps body size and duration), double the bandwidth, and make the app the bottleneck.

## Decision
The server only authorizes and signs. Uploads use S3 multipart with presigned `UploadPart` URLs (5 min). Downloads redirect to a presigned `GetObject` (60 s) with an explicit `Content-Disposition`.

## Consequences
- The app scales with request count, not bytes.
- The bucket needs CORS that allows `PUT` and **exposes `ETag`**.
- The client's claimed size can't be trusted, so quota is charged from `HeadObject` on completion.
- A leaked URL works until it expires, which is why the TTLs are short.
- Inline rendering needs an allow-list, or uploaded HTML/SVG becomes stored XSS on the bucket origin.
