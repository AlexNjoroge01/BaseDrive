# Storage setup

The app speaks the S3 API, so one code path covers Cloudflare R2, MinIO and AWS S3. Only `S3_ENDPOINT` (and `S3_FORCE_PATH_STYLE` for MinIO) changes.

## Cloudflare R2 (production)

1. Create bucket `basedrive`.
2. Create an API token with **Object Read & Write** on that bucket. Use its key/secret as `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`, and set `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`.
3. **CORS.** This is the #1 thing that breaks: the browser must be allowed to `PUT`, and must be able to *read* the `ETag` response header, or multipart completion is impossible.

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

4. **Lifecycle rule:** "Abort incomplete multipart uploads after 1 day". The daily maintenance job also aborts them; this is belt and braces.

## MinIO (local / k8s)

`docker compose up -d` starts MinIO with the `basedrive` bucket. MinIO allows CORS from any origin when `MINIO_API_CORS_ALLOW_ORIGIN=*`, exposes `ETag` by default, and expires stale multipart uploads after 24 h.

MinIO stopped publishing community images to Docker Hub and quay.io in 2025. Compose, CI and k8s use `bitnamilegacy/minio`, which is the same server.

On Kubernetes the server reaches storage at `http://minio:9000`, but browsers can't. Set `S3_PUBLIC_ENDPOINT` to the public hostname. Presigning is offline, so URLs are signed for the public host while server calls stay in-cluster.
