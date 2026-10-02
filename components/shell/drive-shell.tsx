"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, FolderPlus, Upload } from "lucide-react"
import { SidebarProvider } from "@/components/ui/sidebar"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { AppSidebar, NAV } from "@/components/shell/app-sidebar"
import { TopBar } from "@/components/shell/top-bar"
import { useUploadPickers } from "@/components/shell/new-menu"
import type { SessionUser } from "@/components/shell/user-menu"
import { SessionProvider } from "@/components/session-context"
import { NewFolderDialog } from "@/components/dialogs/new-folder-dialog"
import { MoveDialog } from "@/components/dialogs/move-dialog"
import { ShareDialog } from "@/components/dialogs/share-dialog"
import { DeleteDialog } from "@/components/dialogs/delete-dialog"
import { PreviewOverlay } from "@/components/dialogs/preview-overlay"
import { SearchPalette } from "@/components/dialogs/search-palette"
import { UploadDock } from "@/components/upload/upload-dock"
import { useDialogs, usePrefs } from "@/stores/ui-store"
import { useCurrentFolder } from "@/stores/drive-context"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"


function GlobalShortcuts({ onUpload }: { onUpload: () => void }) {
  const open = useDialogs((s) => s.open)
  const toggleDetails = usePrefs((s) => s.toggleDetails)
  const folder = useCurrentFolder()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
      const anyDialog = document.querySelector("[role=dialog],[role=alertdialog]")
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        open("searchOpen", true)
        return
      }
      if (typing || anyDialog || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "/") {
        e.preventDefault()
        open("searchOpen", true)
      } else if (e.key.toLowerCase() === "i") {
        toggleDetails()
      } else if (e.key === "N" && e.shiftKey && folder.canEdit) {
        e.preventDefault()
        open("newFolder", { parentId: folder.id })
      } else if (e.key.toLowerCase() === "u" && !e.shiftKey) {
        onUpload()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, toggleDetails, folder, onUpload])
  return null
}

function MobileNav({ onNewFolder, onUpload }: { onNewFolder: () => void; onUpload: () => void }) {
  const pathname = usePathname()
  const [sheet, setSheet] = React.useState(false)
  const items = NAV.filter((n) => n.href !== "/trash")
  return (
    <>
      <button
        type="button"
        aria-label="New"
        onClick={() => setSheet(true)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-30 grid size-14 place-items-center rounded-full bg-brand text-white shadow-float ring-4 ring-page active:bg-brand-deep sm:hidden"
      >
        <Plus className="size-6" strokeWidth={2.25} />
      </button>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(76px+env(safe-area-inset-bottom))] items-center gap-1 rounded-t-[28px] bg-sidebar-fill px-3 pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {items.map((n) => {
          const active = n.match(pathname)
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-full text-[11px] font-semibold text-white/80",
                active && "bg-white text-brand dark:text-brand-deep"
              )}
            >
              <n.icon className="size-5" strokeWidth={active ? 2.1 : 1.75} />
              {n.label.replace(" with me", "")}
            </Link>
          )
        })}
      </nav>
      <Drawer open={sheet} onOpenChange={setSheet}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Add to this folder</DrawerTitle>
          </DrawerHeader>
          <div className="grid gap-1 px-3 pb-6">
            <button
              type="button"
              onClick={() => (setSheet(false), onUpload())}
              className="flex h-12 items-center gap-3 rounded-md px-3 text-[15px] text-ink active:bg-surface"
            >
              <Upload className="size-5 text-ink-muted" /> Upload files
            </button>
            <button
              type="button"
              onClick={() => (setSheet(false), onNewFolder())}
              className="flex h-12 items-center gap-3 rounded-md px-3 text-[15px] text-ink active:bg-surface"
            >
              <FolderPlus className="size-5 text-ink-muted" /> New folder
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

export function DriveShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const { inputs, pickFiles } = useUploadPickers()
  const open = useDialogs((s) => s.open)
  const folder = useCurrentFolder()
  const upload = React.useCallback(() => void pickFiles(), [pickFiles])
  const wide = useMediaQuery("(min-width: 1024px)")

  return (
    <SessionProvider user={user}>
      {/* Tablet (640–1023px): the sidebar collapses to a 76px rail. */}
      <SidebarProvider open={wide} className="h-svh min-h-0 flex-col bg-page">
        <TopBar user={user} />
        <div className="flex min-h-0 flex-1">
          <div className="hidden sm:flex">
            <AppSidebar isGuest={user.isGuest} rail={!wide} />
          </div>
          <main className="flex min-w-0 flex-1 overflow-hidden bg-page pb-[calc(76px+env(safe-area-inset-bottom))] sm:pb-0">
            {children}
          </main>
        </div>
      </SidebarProvider>

      {inputs}
      <GlobalShortcuts onUpload={upload} />
      <MobileNav onUpload={upload} onNewFolder={() => folder.canEdit && open("newFolder", { parentId: folder.id })} />
      <NewFolderDialog />
      <MoveDialog />
      <ShareDialog />
      <DeleteDialog />
      <PreviewOverlay />
      <SearchPalette onUpload={upload} />
      <UploadDock />
    </SessionProvider>
  )
}
