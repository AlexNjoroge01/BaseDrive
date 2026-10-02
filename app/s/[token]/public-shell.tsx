import Link from "next/link"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/shell/logo"
import { UserAvatar } from "@/components/shell/user-menu"
import type { PersonDTO } from "@/lib/types"

/**
 * No sidebar: a white header (logo, who shared it, Download), then a 120px
 * brand band with the 56px scoop on its bottom-right holding the item name,
 * so the brand shape appears on every public link.
 */
export function PublicShell({
  sharer,
  download,
  title,
  children,
}: {
  sharer?: PersonDTO
  download?: string
  title?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-page">
      <header className="flex h-[72px] shrink-0 items-center gap-4 px-4 sm:px-6">
        <Link href="/login" aria-label="BaseDrive" className="rounded-lg">
          <Wordmark />
        </Link>
        {sharer && (
          <div className="ml-auto flex min-w-0 items-center gap-2 text-[14px] text-ink-muted">
            <UserAvatar user={sharer} className="size-8" />
            <span className="hidden truncate sm:inline">
              Shared by <span className="font-bold text-ink">{sharer.name ?? sharer.email}</span>
            </span>
          </div>
        )}
        {download && (
          <Button render={<a href={download} />} className={sharer ? "" : "ml-auto"}>
            <Download /> Download
          </Button>
        )}
      </header>
      {title && (
        <div className="mr-4 flex h-[120px] shrink-0 items-center rounded-br-[56px] bg-sidebar-fill px-6 sm:mr-10 sm:px-10">
          <h1 className="truncate text-[30px] leading-9 font-extrabold tracking-[-0.02em] text-white">{title}</h1>
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}

export function PublicMessage({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="grid flex-1 place-items-center px-6 py-20">
      <div className="w-full max-w-[380px] rounded-3xl bg-surface p-8 text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-brand text-white">{icon}</div>
        <h1 className="text-dialog-title text-ink">{title}</h1>
        <p className="mt-2 text-[14px] text-ink-muted">{body}</p>
        <Button variant="secondary" className="mt-6 bg-page dark:bg-surface-raised" render={<Link href="/login" />}>
          Go to BaseDrive
        </Button>
      </div>
    </div>
  )
}
