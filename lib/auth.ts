import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import { DrizzleAdapter } from "@auth/drizzle-adapter"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { users, accounts, sessions, verificationTokens } from "@/db/schema"
import { authConfig } from "@/lib/auth.config"
import { signInSchema } from "@/lib/validation"
import { ensureGuestUser } from "@/lib/guest"
import { takeToken } from "@/lib/rate-limit"

class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials"
}
class RateLimited extends CredentialsSignin {
  code = "rate_limited"
}

const githubEnabled = Boolean(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET)

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    // The adapter reads columns by property name, so snake_case SQL is fine.
    usersTable: users as never,
    accountsTable: accounts as never,
    sessionsTable: sessions as never,
    verificationTokensTable: verificationTokens as never,
  }),
  providers: [
    ...(githubEnabled ? [GitHub({ allowDangerousEmailAccountLinking: true })] : []),
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = signInSchema.safeParse(raw)
        if (!parsed.success) throw new InvalidCredentials()
        const { email, password } = parsed.data
        if (!takeToken(`signin:${email}`, 8, 4)) throw new RateLimited()
        const user = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (!user?.passwordHash) throw new InvalidCredentials()
        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) throw new InvalidCredentials()
        return { id: user.id, email: user.email, name: user.name, image: user.image, isGuest: false }
      },
    }),
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: {},
      async authorize() {
        const user = await ensureGuestUser()
        return { id: user.id, email: user.email, name: user.name, image: user.image, isGuest: true }
      },
    }),
  ],
})
