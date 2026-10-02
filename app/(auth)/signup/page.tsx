import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"
import { env } from "@/lib/env"

export const metadata: Metadata = { title: "Create account" }

export default function SignupPage() {
  return <AuthForm mode="signup" githubEnabled={env.githubEnabled} />
}
