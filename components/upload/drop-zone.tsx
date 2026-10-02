"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { filesFromDataTransfer, uploadWithFolders } from "@/lib/client/folder-upload"
import { invalidateDrive } from "@/lib/client/queries"
import { cn } from "@/lib/utils"

/**
 * The whole content sheet is a drop zone: dashed accent inset outline,
 * 60% accent wash, one line: "Drop to upload to Acme". Folder tiles/rows
 * handle their own drops (and stop propagation) so they win.
 */
export function DropZone({
  target,
  enabled,
  children,
  className,
}: {
  target: { parentId: string | null; parentName: string }
  enabled: boolean
  children: React.ReactNode
  className?: string
}) {
  const [over, setOver] = React.useState(false)
  const depth = React.useRef(0)
  const qc = useQueryClient()
  const isFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files")

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={(e) => {
        if (!isFiles(e)) return
        e.preventDefault()
        depth.current++
        setOver(true)
      }}
      onDragOver={(e) => {
        if (!isFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = enabled ? "copy" : "none"
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (!depth.current) setOver(false)
      }}
      onDrop={async (e) => {
        if (!isFiles(e)) return
        e.preventDefault()
        depth.current = 0
        setOver(false)
        if (!enabled) return toast.error("You can view this folder but not add to it.")
        const files = await filesFromDataTransfer(e.dataTransfer)
        if (files.length) void uploadWithFolders(files, target, () => invalidateDrive(qc))
      }}
    >
      {children}
      <AnimatePresence>
        {over && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-3xl border-[3px] border-dashed border-brand bg-brand-tint/70"
          >
            <div className="flex flex-col items-center gap-3 text-[18px] font-bold text-brand dark:text-[#7fa1ff]">
              <span className="grid size-14 place-items-center rounded-full bg-brand text-white">
                <Upload className="size-6" strokeWidth={2.25} />
              </span>
              {enabled ? <>Drop to upload to {target.parentName}</> : "You can't add files to this folder"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
