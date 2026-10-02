"use client"

import * as React from "react"
import { Check, ChevronDown, Copy, Globe, Lock, UserMinus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UserAvatar } from "@/components/shell/user-menu"
import { useSessionUser } from "@/components/session-context"
import { useDialogs } from "@/stores/ui-store"
import { useAccess, useItem, useShareMutations } from "@/lib/client/queries"
import { errorMessage } from "@/lib/client/api"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import type { Role } from "@/lib/types"

const ROLE_LABEL: Record<Role, string> = { VIEWER: "Viewer", EDITOR: "Editor" }

const EXPIRY = [
  { value: "never", label: "Never" },
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const

function RolePicker({
  value,
  onChange,
  onRemove,
  disabled,
}: {
  value: Role
  onChange: (r: Role) => void
  onRemove?: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2.5 text-[13px] font-medium text-ink-muted hover:text-ink"
          />
        }
      >
        {ROLE_LABEL[value]}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as Role)}>
          <DropdownMenuRadioItem value="VIEWER">Viewer</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="EDITOR">Editor</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {onRemove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onRemove}>
              <UserMinus /> Remove access
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ShareDialog() {
  const id = useDialogs((s) => s.shareId)
  const close = useDialogs((s) => s.close)
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && close("shareId")}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">{id && <ShareBody id={id} />}</DialogContent>
    </Dialog>
  )
}

function ShareBody({ id }: { id: string }) {
  const me = useSessionUser()
  const close = useDialogs((s) => s.close)
  const { data: details } = useItem(id)
  const { data: access, isLoading } = useAccess(id)
  const { grant, revoke, link, unlink } = useShareMutations(id)
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<Role>("VIEWER")
  const [emailError, setEmailError] = React.useState<string | null>(null)
  const [pwToggle, setPwOpen] = React.useState<boolean | null>(null)
  const [pw, setPw] = React.useState("")
  const [copied, setCopied] = React.useState(false)

  const item = details?.item
  const activeLink = access?.link ?? null
  const inherited = (access?.entries ?? []).filter((e) => e.via)

  const pwOpen = pwToggle ?? !!activeLink?.hasPassword
  const [now] = React.useState(() => Date.now())

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setEmailError("Enter a valid email.")
    grant.mutate(
      { email: email.trim().toLowerCase(), role },
      {
        onSuccess: (r) => {
          toast.success(`Shared with ${r.name.split(" ")[0]}`)
          setEmail("")
        },
        onError: (err) => setEmailError(errorMessage(err)),
      }
    )
  }

  const expiryValue = (() => {
    if (!activeLink?.expiresAt) return "never"
    const days = Math.round((new Date(activeLink.expiresAt).getTime() - now) / 86_400_000)
    return days <= 1 ? "1" : days <= 7 ? "7" : "30"
  })()

  const copy = async () => {
    try {
      if (activeLink) {
        await navigator.clipboard.writeText(activeLink.url)
        toast.success("Link copied")
      } else if (item) {
        const path = item.type === "FOLDER" ? `/drive/${item.id}` : `/drive/${item.parentId ?? ""}?preview=${item.id}`
        await navigator.clipboard.writeText(window.location.origin + path.replace("/drive/?", "/drive?"))
        toast.success("Link copied", { description: "Only people with access can open it." })
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error("Couldn't copy to the clipboard.")
    }
  }

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4">
        <DialogTitle className="truncate pr-8">
          {item ? <>Share &ldquo;{item.name}&rdquo;</> : <Skeleton className="h-6 w-48" />}
        </DialogTitle>
        <DialogDescription className="sr-only">Add people or create a link.</DialogDescription>
      </DialogHeader>

      <form onSubmit={addPerson} className="flex items-start gap-2 px-6">
        <div className="flex-1">
          <div
            className={cn(
              "flex h-11 items-center rounded-full bg-surface pr-1.5 focus-within:bg-page focus-within:ring-2 focus-within:ring-focus dark:focus-within:bg-surface-raised",
              emailError && "ring-2 ring-danger focus-within:ring-danger"
            )}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError(null)
              }}
              placeholder="Add people by email"
              aria-label="Add people by email"
              aria-invalid={!!emailError}
              className="h-full min-w-0 flex-1 bg-transparent px-4 text-[14px] text-ink outline-none placeholder:text-ink-faint"
            />
            <RolePicker value={role} onChange={setRole} />
          </div>
          {emailError && <p className="mt-1.5 text-meta text-danger">{emailError}</p>}
        </div>
        <Button type="submit" className="h-11" disabled={!email || grant.isPending}>
          {grant.isPending && <Spinner />}
          Share
        </Button>
      </form>

      <div className="px-6 pt-5">
        <p className="text-[15px] font-bold text-ink">People with access</p>
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {isLoading || !access ? (
            Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="flex h-12 items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-2.5 w-44" />
                </div>
              </li>
            ))
          ) : (
            <>
              <li className="flex h-12 items-center gap-3">
                <UserAvatar user={access.owner} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">
                    {access.owner.name ?? access.owner.email}
                    {access.owner.id === me.id && <span className="font-normal text-ink-muted"> (you)</span>}
                  </p>
                  <p className="truncate text-meta text-ink-muted">{access.owner.email}</p>
                </div>
                <span className="px-2.5 text-[13px] text-ink-muted">Owner</span>
              </li>
              {access.entries.map((e) => (
                <li key={e.user.id} className="flex h-12 items-center gap-3">
                  <UserAvatar user={e.user} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-ink">
                      {e.user.name ?? e.user.email}
                      {e.user.id === me.id && <span className="font-normal text-ink-muted"> (you)</span>}
                    </p>
                    <p className="truncate text-meta text-ink-muted">
                      {e.via ? <>Shared through the folder {e.via.name}</> : e.user.email}
                    </p>
                  </div>
                  {e.via || !access.canShare ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="px-2.5 text-[13px] text-ink-muted" />}>
                        {ROLE_LABEL[e.role as Role]}
                      </TooltipTrigger>
                      <TooltipContent>
                        {e.via ? `Change this on ${e.via.name}` : "Only the owner can change access"}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <RolePicker
                      value={e.role as Role}
                      onChange={(r) => grant.mutate({ email: e.user.email, role: r })}
                      onRemove={() => revoke.mutate(e.user.id)}
                    />
                  )}
                </li>
              ))}
            </>
          )}
        </ul>
        {inherited.length > 0 && (
          <p className="mt-1 text-small text-ink-faint">
            People with access to a parent folder can open this too.
          </p>
        )}
      </div>

      <Separator className="mt-5" />

      <div className="space-y-4 px-6 pt-5">
        <p className="text-[15px] font-bold text-ink">Link access</p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-full",
              activeLink ? "bg-brand text-white" : "bg-surface text-ink-muted"
            )}
          >
            {activeLink ? <Globe className="size-[18px]" /> : <Lock className="size-[18px]" />}
          </span>
          <Select
            value={activeLink ? "anyone" : "restricted"}
            items={[
              { value: "restricted", label: "Restricted" },
              { value: "anyone", label: "Anyone with the link" },
            ]}
            onValueChange={(v) => {
              if (v === "anyone" && !activeLink) link.mutate({ role: "VIEWER" })
              if (v === "restricted" && activeLink) unlink.mutate(activeLink.id)
            }}
            disabled={link.isPending || unlink.isPending}
          >
            <SelectTrigger aria-label="Link access" className="h-10 min-w-48 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="restricted">Restricted</SelectItem>
              <SelectItem value="anyone">Anyone with the link</SelectItem>
            </SelectContent>
          </Select>
          {activeLink && <RolePicker value={activeLink.role} onChange={(r) => link.mutate({ role: r })} />}
          <p className="basis-full pl-[52px] text-meta text-ink-muted">
            {activeLink
              ? `Anyone with the link can ${activeLink.role === "EDITOR" ? "edit" : "view"}. Created ${format(new Date(activeLink.createdAt), "d MMM")}.`
              : "Only people added above can open it."}
          </p>
        </div>

        {activeLink && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-surface px-4 py-3">
            <label className="flex items-center gap-2 text-meta font-semibold text-ink">
              Expires
              <Select
                value={expiryValue}
                items={EXPIRY.map((e) => ({ value: e.value, label: e.label }))}
                onValueChange={(v) =>
                  link.mutate({
                    expiresAt:
                      v === "never" ? null : new Date(Date.now() + Number(v) * 86_400_000).toISOString(),
                  })
                }
              >
                <SelectTrigger size="sm" className="h-9 min-w-28 bg-page dark:bg-surface-raised">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="flex items-center gap-2 text-meta font-semibold text-ink">
              <Lock className="size-4 text-ink-muted" />
              Password
              <Switch
                checked={pwOpen}
                onCheckedChange={(v) => {
                  setPwOpen(v)
                  if (!v && activeLink.hasPassword) {
                    link.mutate({ password: null }, { onSuccess: () => toast.success("Password removed") })
                  }
                }}
                aria-label="Password protect link"
              />
              <span className="text-ink-muted">{pwOpen ? (activeLink.hasPassword ? "On" : "") : "Off"}</span>
            </div>
            {pwOpen && (
              <form
                className="flex w-full items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (pw.length < 4) return toast.error("Use at least 4 characters.")
                  link.mutate(
                    { password: pw },
                    { onSuccess: () => (setPw(""), toast.success("Password set")) }
                  )
                }}
              >
                <Input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={activeLink.hasPassword ? "Set a new password" : "Choose a password"}
                  className="h-10 max-w-64 rounded-full bg-page px-4 dark:bg-surface-raised"
                  autoComplete="new-password"
                />
                <Button type="submit" size="sm" disabled={!pw}>
                  {activeLink.hasPassword ? "Update" : "Set password"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="mt-6 flex-row items-center justify-between px-6 pb-6 sm:justify-between">
        <Button variant="secondary" onClick={copy} disabled={!item}>
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button onClick={() => close("shareId")}>Done</Button>
      </DialogFooter>
    </>
  )
}

