import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

/**
 * One code path for R2, MinIO and AWS S3: only S3_ENDPOINT changes.
 * The server signs URLs; file bytes go browser ↔ bucket directly.
 */
const globalForS3 = globalThis as unknown as { __basedriveS3?: S3Client }

export const s3 =
  globalForS3.__basedriveS3 ??
  new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    // R2 rejects the newer default checksum headers on presigned PUTs.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
if (process.env.NODE_ENV !== "production") globalForS3.__basedriveS3 = s3

/**
 * Presigning is offline (no network call), so it can use the public hostname
 * browsers see while server-side calls go to the in-cluster one (k8s).
 */
const presigner = process.env.S3_PUBLIC_ENDPOINT
  ? new S3Client({
      endpoint: process.env.S3_PUBLIC_ENDPOINT,
      region: process.env.S3_REGION ?? "auto",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : s3

export const BUCKET = process.env.S3_BUCKET ?? "basedrive"

export const PUT_URL_TTL = 5 * 60 // 5 min
export const GET_URL_TTL = 60 // 60 s

export const objectKey = (ownerId: string, itemId: string) => `u/${ownerId}/${itemId}`
export const thumbnailKey = (itemId: string) => `t/${itemId}.webp`

export async function createMultipartUpload(key: string, contentType: string) {
  const res = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    })
  )
  if (!res.UploadId) throw new Error("Storage did not return an upload id")
  return res.UploadId
}

export function presignPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    presigner,
    new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: PUT_URL_TTL }
  )
}

export async function listUploadedParts(key: string, uploadId: string) {
  const parts: { partNumber: number; etag: string; size: number }[] = []
  let marker: string | undefined
  do {
    const res = await s3.send(
      new ListPartsCommand({
        Bucket: BUCKET,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker,
      })
    )
    for (const p of res.Parts ?? []) {
      if (p.PartNumber && p.ETag)
        parts.push({ partNumber: p.PartNumber, etag: p.ETag, size: p.Size ?? 0 })
    }
    marker = res.IsTruncated ? res.NextPartNumberMarker : undefined
  } while (marker)
  return parts
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
) {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    })
  )
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  try {
    await s3.send(
      new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId })
    )
  } catch (err) {
    // Already completed/aborted uploads are fine to ignore.
    if ((err as { name?: string }).name !== "NoSuchUpload") throw err
  }
}

export async function headObject(key: string) {
  const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
  return { size: res.ContentLength ?? 0, contentType: res.ContentType }
}

/** MIME types safe to render inline. Everything else is forced to download. */
const INLINE_SAFE = [
  /^image\/(png|jpe?g|gif|webp|avif|bmp)$/,
  /^video\/(mp4|webm|quicktime)$/,
  /^audio\//,
  /^application\/pdf$/,
]

export function isInlineSafe(mime: string | null | undefined) {
  return !!mime && INLINE_SAFE.some((r) => r.test(mime))
}

export function contentDisposition(kind: "inline" | "attachment", filename: string) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export function presignGet(
  key: string,
  opts: {
    filename: string
    disposition: "inline" | "attachment"
    contentType?: string
  }
) {
  return getSignedUrl(
    presigner,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: contentDisposition(opts.disposition, opts.filename),
      ResponseContentType: opts.contentType,
    }),
    { expiresIn: GET_URL_TTL }
  )
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  const bytes = await res.Body!.transformToByteArray()
  return Buffer.from(bytes)
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  )
}

export async function deleteObjects(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000)
    if (!chunk.length) continue
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    )
  }
}
