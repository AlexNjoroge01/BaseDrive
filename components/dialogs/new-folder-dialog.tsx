"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useDialogs } from "@/stores/ui-store"
import { useCurrentFolder } from "@/stores/drive-context"
import { useCreateFolder } from "@/lib/client/queries"
import { ApiClientError } from "@/lib/client/api"

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a name.")
    .max(255, "Names can be up to 255 characters.")
    .refine((v) => !/[\\/]/.test(v), "Names can't contain / or \\."),
})

export function NewFolderDialog() {
  const state = useDialogs((s) => s.newFolder)
  const close = useDialogs((s) => s.close)
  const folderName = useCurrentFolder((s) => s.name)
  const create = useCreateFolder()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "Untitled folder" },
  })

  React.useEffect(() => {
    if (state) form.reset({ name: "Untitled folder" })
  }, [state, form])

  const onSubmit = form.handleSubmit(({ name }) =>
    create.mutate(
      { name, parentId: state?.parentId ?? null },
      {
        onSuccess: () => close("newFolder"),
        onError: (err) =>
          form.setError("name", {
            message:
              err instanceof ApiClientError && err.code === "NAME_CONFLICT"
                ? `A folder named ${name} already exists here.`
                : err.message,
          }),
      }
    )
  )

  return (
    <Dialog open={!!state} onOpenChange={(o) => !o && close("newFolder")}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={onSubmit} className="grid gap-6">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>In {folderName}</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!form.formState.errors.name}>
            <FieldLabel htmlFor="folder-name" className="sr-only">
              Folder name
            </FieldLabel>
            <Input
              id="folder-name"
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              aria-invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close("newFolder")}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Spinner />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
