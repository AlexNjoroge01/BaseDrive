import type { NextAuthConfig } from "next-auth"

/**
 * The slice of auth config that proxy.ts needs: JWT decoding and callbacks,
 * no database. Providers that touch the DB are added in lib/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id
        token.isGuest = (user as { isGuest?: boolean }).isGuest ?? false
      }
      return token
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string
      session.user.isGuest = Boolean(token.isGuest)
      return session
    },
  },
} satisfies NextAuthConfig

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isGuest: boolean
    }
  }
}
