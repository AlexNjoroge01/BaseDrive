"use server"

import { AuthError } from "next-auth"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users } from "@/db/schema"
import { signIn, signOut } from "@/lib/auth"
import { signInSchema, signUpSchema } from "@/lib/validation"
import { rateLimit } from "@/lib/rate-limit"
import { ApiError } from "@/lib/api"

export type AuthState = { error?: string; fieldErrors?: Record<string, string> } | undefined

const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/drive"

function authErrorMessage(err: AuthError) {
  const code = (err as AuthError & { code?: string }).code
  if (code === "rate_limited") return "Too many attempts. Wait a minute and try again."
  if (err.type === "CredentialsSignin") return "That email and password don't match."
  return "Couldn't sign you in. Try again."
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  })
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])) }
  }
  try {
    await rateLimit("signin", 10, 5)
    await signIn("credentials", { ...parsed.data, redirectTo: safeNext(form.get("next")) })
  } catch (err) {
    if (err instanceof AuthError) return { error: authErrorMessage(err) }
    if (err instanceof ApiError) return { error: err.message }
    throw err // redirect
  }
}

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
  })
  if (!parsed.success) {
    return { fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])) }
  }
  const { name, email, password } = parsed.data
  try {
    await rateLimit("signup", 5, 2)
  } catch (err) {
    return { error: (err as Error).message }
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) return { fieldErrors: { email: "An account with this email already exists." } }

  await db.insert(users).values({ name, email, passwordHash: await bcrypt.hash(password, 12) })
  try {
    await signIn("credentials", { email, password, redirectTo: "/drive" })
  } catch (err) {
    if (err instanceof AuthError) return { error: authErrorMessage(err) }
    throw err
  }
}

export async function guestAction(form: FormData) {
  await rateLimit("guest", 20, 10).catch(() => {})
  await signIn("guest", { redirectTo: safeNext(form.get("next")) })
}

export async function githubAction(form: FormData) {
  await signIn("github", { redirectTo: safeNext(form.get("next")) })
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" })
}
