import {
  pgTable,
  pgEnum,
  text,
  bigint,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => createId())
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull()

export const itemType = pgEnum("item_type", ["FILE", "FOLDER"])
export const itemStatus = pgEnum("item_status", ["UPLOADING", "READY", "FAILED"])
export const role = pgEnum("role", ["VIEWER", "EDITOR"])
export const folderColor = pgEnum("folder_color", ["blue", "coral", "sun", "mint", "violet", "aqua"])
export const jobType = pgEnum("job_type", ["THUMBNAIL", "PURGE_ITEM"])
export const jobStatus = pgEnum("job_status", [
  "PENDING",
  "RUNNING",
  "DONE",
  "FAILED",
])

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
  passwordHash: text("password_hash"),
  storageUsed: bigint("storage_used", { mode: "number" }).default(0).notNull(),
  storageQuota: bigint("storage_quota", { mode: "number" })
    .default(524_288_000) // 500 MB
    .notNull(),
  isGuest: boolean("is_guest").default(false).notNull(),
  createdAt: createdAt(),
})

// Auth.js adapter tables. Property names are what the adapter reads.
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
)

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
)

export const items = pgTable(
  "items",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnyPgColumn => items.id), // null = root
    type: itemType("type").notNull(),
    name: text("name").notNull(),
    path: text("path").notNull(), // materialized: "/rootId/.../thisId/"
    mimeType: text("mime_type"),
    size: bigint("size", { mode: "number" }).default(0).notNull(),
    storageKey: text("storage_key").unique(), // "u/{ownerId}/{itemId}"
    thumbnailKey: text("thumbnail_key"),
    status: itemStatus("status").default("READY").notNull(),
    color: folderColor("color").default("blue").notNull(), // folders only
    pinnedAt: timestamp("pinned_at", { withTimezone: true }), // "Pin to top"
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("items_owner_parent_idx").on(t.ownerId, t.parentId),
    index("items_path_prefix_idx").using("btree", sql`${t.path} text_pattern_ops`),
    index("items_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
    index("items_trashed_idx").on(t.ownerId, t.trashedAt),
    index("items_pinned_idx").on(t.ownerId, t.pinnedAt),
    // No duplicate names in the same folder, ignoring trashed items
    uniqueIndex("items_unique_name_in_folder")
      .on(t.ownerId, sql`coalesce(${t.parentId}, 'root')`, sql`lower(${t.name})`)
      .where(sql`${t.trashedAt} is null`),
  ]
)

export const stars = pgTable(
  "stars",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] })]
)

export const uploads = pgTable("uploads", {
  id: id(),
  itemId: text("item_id")
    .notNull()
    .unique()
    .references(() => items.id, { onDelete: "cascade" }),
  s3UploadId: text("s3_upload_id").notNull(),
  partSize: integer("part_size").notNull(), // 8 MB
  totalParts: integer("total_parts").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
})

export const shareGrants = pgTable(
  "share_grants",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: role("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("share_grants_item_user").on(t.itemId, t.userId),
    index("share_grants_user_idx").on(t.userId),
  ]
)

export const shareLinks = pgTable(
  "share_links",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(), // SHA-256 of token, never the token
    role: role("role").default("VIEWER").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    passwordHash: text("password_hash"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("share_links_item_idx").on(t.itemId)]
)

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: jobType("type").notNull(),
    payload: jsonb("payload").notNull(),
    status: jobStatus("status").default("PENDING").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_status_run_at_idx").on(t.status, t.runAt)]
)

export type User = typeof users.$inferSelect
export type Item = typeof items.$inferSelect
export type ShareLink = typeof shareLinks.$inferSelect
export type ShareGrant = typeof shareGrants.$inferSelect
export type Job = typeof jobs.$inferSelect
export type Role = (typeof role.enumValues)[number]
export type FolderColor = (typeof folderColor.enumValues)[number]
