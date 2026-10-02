export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  maxFileBytes: Number(process.env.MAX_FILE_BYTES ?? 104_857_600),
  globalStorageCapBytes: Number(
    process.env.GLOBAL_STORAGE_CAP_BYTES ?? 8_589_934_592
  ),
  cronSecret: process.env.CRON_SECRET,
  authSecret: process.env.AUTH_SECRET ?? "",
  githubEnabled: Boolean(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
  ),
}

export const UPLOAD_PART_SIZE = 8 * 1024 * 1024 // 8 MB
export const TRASH_RETENTION_DAYS = 30
