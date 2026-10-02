"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { unlockLink, type UnlockState } from "./actions"

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="h-12 w-full text-[15px] font-bold" disabled={pending}>
      {pending && <Spinner />}
      Open
    </Button>
  )
}

export function PasswordGate({ token }: { token: string }) {
  const [state, action] = React.useActionState<UnlockState, FormData>(unlockLink, undefined)
  return (
    <div className="grid flex-1 place-items-center px-6 py-20">
      <form
        action={action}
        className="w-full max-w-[380px] space-y-5 rounded-3xl bg-surface p-8"
      >
        <input type="hidden" name="token" value={token} />
        <div className="grid size-12 place-items-center rounded-full bg-brand text-white">
          <Lock className="size-5" />
        </div>
        <div className="space-y-1">
          <h1 className="text-dialog-title text-ink">This link is password-protected</h1>
          <p className="text-[14px] text-ink-muted">Enter the password the owner gave you.</p>
        </div>
        <Field data-invalid={!!state?.error}>
          <FieldLabel htmlFor="password" className="sr-only">
            Password
          </FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoFocus
            placeholder="Password"
            className="h-12 rounded-full bg-page px-5 dark:bg-surface-raised"
            aria-invalid={!!state?.error}
          />
          <FieldError>{state?.error}</FieldError>
        </Field>
        <Submit />
      </form>
    </div>
  )
}
