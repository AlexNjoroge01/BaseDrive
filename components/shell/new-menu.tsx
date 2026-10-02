"use client"

import * as React from "react"
import { FolderPlus, FolderUp, Plus, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentFolder } from "@/stores/drive-context"
import { useDialogs } from "@/stores/ui-store"
import { enqueueUploads } from "@/lib/client/uploader"
import { uploadWithFolders } from "@/lib/client/folder-upload"
import { useQueryClient } from "@tanstack/react-query"
import { invalidateDrive } from "@/lib/client/queries"
import { cn } from "@/lib/utils"

/** Hidden inputs + handlers shared by the New menu, empty states and the mobile FAB. */
export function useUploadPickers() {
  const filesRef = React.useRef<HTMLInputElement>(null)
  const folderRef = React.useRef<HTMLInputElement>(null)
  const folder = useCurrentFolder()
  const qc = useQueryClient()

  const guard = () => {
    if (!folder.canEdit) {
      toast.error("You can view this folder but not add to it.")
      return false
    }
    return true
  }

  const inputs = (
    <>
      <input
        ref={filesRef}
        type="file"
        multiple
        hidden
        data-testid="file-input"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          if (files.length) enqueueUploads(files, { parentId: folder.id, parentName: folder.name })
          e.target.value = ""
        }}
      />
      <input
        ref={folderRef}
        type="file"
        hidden
        multiple
        // @ts-expect-error non-standard but universally supported
        webkitdirectory=""
        onChange={(e) => {
          const files = [...(e.target.files ?? [])].map((file) => ({
            file,
            path: file.webkitRelativePath || file.name,
          }))
          if (files.length)
            void uploadWithFolders(files, { parentId: folder.id, parentName: folder.name }, () =>
              invalidateDrive(qc)
            )
          e.target.value = ""
        }}
      />
    </>
  )

  return {
    inputs,
    pickFiles: () => guard() && filesRef.current?.click(),
    pickFolder: () => guard() && folderRef.current?.click(),
  }
}

export function NewMenu({ className, collapsed }: { className?: string; collapsed?: boolean }) {
  const { inputs, pickFiles, pickFolder } = useUploadPickers()
  const folder = useCurrentFolder()
  const open = useDialogs((s) => s.open)

  return (
    <>
      {inputs}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="onBrand"
              size={collapsed ? "icon-lg" : "lg"}
              className={cn(
                "text-[15px] font-bold",
                collapsed ? "size-11" : "h-11 w-full justify-start px-5",
                className
              )}
              aria-label="New"
            />
          }
        >
          <Plus className="size-5" strokeWidth={2.5} />
          {!collapsed && <span>New</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-56">
          <DropdownMenuItem
            onClick={() => {
              if (!folder.canEdit) return toast.error("You can view this folder but not add to it.")
              open("newFolder", { parentId: folder.id })
            }}
          >
            <FolderPlus />
            New folder
            <DropdownMenuShortcut>⇧N</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={pickFiles}>
            <Upload />
            Upload files
            <DropdownMenuShortcut>U</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={pickFolder}>
            <FolderUp />
            Upload folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
