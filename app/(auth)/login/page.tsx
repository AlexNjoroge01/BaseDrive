import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { env } from "@/lib/env"

export const metadata: Metadata = { title: "Sign in" }

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email is already linked to another sign-in method.",
  AccessDenied: "Access was denied.",
  Configuration: "Sign-in isn't configured correctly on this server.",
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams
  const next = typeof sp.next === "string" ? sp.next : undefined
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? "Couldn't sign you in. Try again.") : undefined
  return <AuthForm mode="signin" next={next} githubEnabled={env.githubEnabled} error={error} />
}
