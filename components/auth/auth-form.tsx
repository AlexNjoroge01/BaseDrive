"use client"

import * as React from "react"
import Link from "next/link"
import { useFormStatus } from "react-dom"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { GitHubIcon } from "@/components/shell/logo"
import {
  githubAction,
  guestAction,
  signInAction,
  signUpAction,
  type AuthState,
} from "@/app/actions/auth"

function Submit({ children, variant = "default", className }: { children: React.ReactNode; variant?: "default" | "secondary"; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" variant={variant} disabled={pending} className={className}>
      {pending && <Spinner />}
      {children}
    </Button>
  )
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-meta text-ink-faint">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

export function AuthForm({
  mode,
  next,
  githubEnabled,
  error: initialError,
}: {
  mode: "signin" | "signup"
  next?: string
  githubEnabled: boolean
  error?: string
}) {
  const [state, action] = React.useActionState<AuthState, FormData>(
    mode === "signin" ? signInAction : signUpAction,
    initialError ? { error: initialError } : undefined
  )
  const fe = state?.fieldErrors ?? {}

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center gap-7 py-6 lg:py-12">
        <div className="space-y-1.5">
          <h1 className="text-title">{mode === "signin" ? "Sign in to BaseDrive" : "Create your drive"}</h1>
          <p className="text-[14px] text-ink-muted">
            {mode === "signin" ? "Your files, right where you left them." : "500 MB free. No card, no catch."}
          </p>
        </div>

        <form action={guestAction} className="space-y-2">
          <input type="hidden" name="next" value={next ?? ""} />
          <Submit className="h-12 w-full text-[16px] font-bold">
            <Sparkles className="size-4" />
            Try as guest
          </Submit>
          <p className="text-center text-meta text-ink-muted">
            Opens a demo drive with sample files. Resets daily.
          </p>
        </form>

        <Divider />

        {githubEnabled && (
          <form action={githubAction}>
            <input type="hidden" name="next" value={next ?? ""} />
            <Submit variant="secondary" className="h-11 w-full">
              <GitHubIcon />
              Continue with GitHub
            </Submit>
          </form>
        )}

        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="next" value={next ?? ""} />
          {mode === "signup" && (
            <Field data-invalid={!!fe.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" name="name" autoComplete="name" className="h-12 px-4" aria-invalid={!!fe.name} />
              <FieldError>{fe.name}</FieldError>
            </Field>
          )}
          <Field data-invalid={!!fe.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className="h-12 px-4"
              aria-invalid={!!fe.email}
            />
            <FieldError>{fe.email}</FieldError>
          </Field>
          <Field data-invalid={!!fe.password}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="h-12 px-4"
              aria-invalid={!!fe.password}
            />
            <FieldError>{fe.password}</FieldError>
          </Field>
          {state?.error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-meta font-medium text-danger">
              {state.error}
            </p>
          )}
          <Submit variant="secondary" className="h-11 w-full">
            {mode === "signin" ? "Sign in" : "Create account"}
          </Submit>
        </form>

        <p className="text-center text-meta text-ink-muted">
          {mode === "signin" ? (
            <>
              New here?{" "}
              <Link href="/signup" className="font-bold text-brand hover:underline dark:text-[#7fa1ff]">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-brand hover:underline dark:text-[#7fa1ff]">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>

      <p className="mx-auto max-w-[400px] text-center text-small font-normal text-ink-faint">
        A portfolio project. Files live in S3-compatible storage; the server never touches the bytes.
      </p>
    </div>
  )
}
