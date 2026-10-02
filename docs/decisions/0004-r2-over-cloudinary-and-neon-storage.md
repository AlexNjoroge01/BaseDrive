# 4. Cloudflare R2 (S3 API) over Cloudinary and Neon Object Storage

**Status:** accepted

## Context
The app stores arbitrary files (PDFs, zips, code) at KES 0 budget, and the point of the project is owning object storage.

## Options
- **Cloudinary.** A media pipeline for transforming and delivering images and video. It's the wrong shape for generic files and hides the storage layer this project exists to demonstrate.
- **Neon Object Storage.** S3-compatible and branches with the DB. But on the free plan it's 5 GB, and downloads count against the *same* 5 GB/month transfer as the database. Exceeding it suspends the database. A download-heavy demo day could take the whole app offline.
- **Cloudflare R2.** 10 GB free, $0 egress, independent of the database, S3 API.

## Decision
R2 in production and MinIO locally/on k8s, behind one S3 client configured by `S3_ENDPOINT`.

## Consequences
One code path for R2, MinIO and AWS S3. Revisit Neon storage on a paid plan.
