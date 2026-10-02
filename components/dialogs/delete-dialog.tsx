"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDialogs } from "@/stores/ui-store"
import { useSelection } from "@/stores/selection-store"
import { qk, useDeleteForever } from "@/lib/client/queries"
import type { ItemDTO } from "@/lib/types"

/** "Delete 'Brief v3.pdf' forever? You can't undo this." */
export function DeleteDialog() {
  const ids = useDialogs((s) => s.deleteIds)
  const close = useDialogs((s) => s.close)
  const clear = useSelection((s) => s.clear)
  const qc = useQueryClient()
  const del = useDeleteForever()
  const all = ids?.length === 1 && ids[0] === "__all__"
  const trash = qc.getQueryData<ItemDTO[]>(qk.list("trash")) ?? []
  const first = trash.find((i) => i.id === ids?.[0])

  const title = all
    ? "Empty trash?"
    : ids && ids.length > 1
      ? `Delete ${ids.length} items forever?`
      : `Delete '${first?.name ?? "this item"}' forever?`

  return (
    <AlertDialog open={!!ids} onOpenChange={(o) => !o && close("deleteIds")}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {all
              ? "Everything in Trash will be deleted forever. You can't undo this."
              : "You can't undo this."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="bg-danger text-white hover:bg-danger/90"
            onClick={() => {
              if (!ids) return
              del.mutate(all ? { all: true } : { ids })
              clear()
              close("deleteIds")
            }}
          >
            {all ? "Empty trash" : "Delete forever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
