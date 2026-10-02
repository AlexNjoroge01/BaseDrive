import { z } from "zod"
import { sanitizeName } from "@/lib/names"

/** CUID2 ids: lowercase alphanumerics. Anything else can't exist → 404 early. */
export const idSchema = z.string().regex(/^[a-z0-9]{20,32}$/, "Invalid id")

export const nameSchema = z
  .string()
  .transform((s) => sanitizeName(s))
  .pipe(
    z
      .string()
      .min(1, "Enter a name.")
      .max(255, "Names can be up to 255 characters.")
  )

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use at most 128 characters.")

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.email("Enter a valid email.").transform((e) => e.toLowerCase()),
  password: passwordSchema,
})

export const signInSchema = z.object({
  email: z.email("Enter a valid email.").transform((e) => e.toLowerCase()),
  password: z.string().min(1, "Enter your password."),
})

export const createFolderSchema = z.object({
  name: nameSchema,
  parentId: idSchema.nullable(),
})

export const folderColorSchema = z.enum(["blue", "coral", "sun", "mint", "violet", "aqua"])

export const updateItemSchema = z
  .object({
    name: nameSchema.optional(),
    parentId: idSchema.nullable().optional(),
    color: folderColorSchema.optional(),
    pinned: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Nothing to update.",
  })

export const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    ids: z.array(idSchema).min(1).max(500),
    parentId: idSchema.nullable(),
  }),
  z.object({ action: z.literal("trash"), ids: z.array(idSchema).min(1).max(500) }),
  z.object({ action: z.literal("restore"), ids: z.array(idSchema).min(1).max(500) }),
  z.object({ action: z.literal("delete"), ids: z.array(idSchema).min(1).max(500) }),
])

export const startUploadSchema = z.object({
  name: nameSchema,
  size: z.number().int().nonnegative(),
  mimeType: z.string().max(255).default("application/octet-stream"),
  parentId: idSchema.nullable(),
  onConflict: z.enum(["fail", "keepBoth", "replace"]).default("fail"),
})

export const presignPartsSchema = z.object({
  partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(100),
})

export const completeUploadSchema = z.object({
  parts: z
    .array(z.object({ partNumber: z.number().int().min(1), etag: z.string().min(1) }))
    .min(1),
})

export const roleSchema = z.enum(["VIEWER", "EDITOR"])

export const grantSchema = z.object({
  email: z.email("Enter a valid email.").transform((e) => e.toLowerCase()),
  role: roleSchema,
})

export const linkSchema = z.object({
  role: roleSchema.default("VIEWER"),
  expiresAt: z.coerce.date().nullable().optional(),
  password: z.string().min(4, "Use at least 4 characters.").max(128).nullable().optional(),
})

export const updateLinkSchema = z.object({
  role: roleSchema.optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  password: z.string().min(4).max(128).nullable().optional(),
})

export const searchSchema = z.object({
  q: z.string().trim().max(200).default(""),
  kind: z.string().optional(),
})
