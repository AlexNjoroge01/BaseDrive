"use client"

import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { initials } from "@/lib/format"
import { signOutAction } from "@/app/actions/auth"

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
  isGuest: boolean
}

export function UserAvatar({
  user,
  className,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null }
  className?: string
}) {
  return (
    <Avatar className={className}>
      {user.image && <AvatarImage src={user.image} alt="" />}
      <AvatarFallback className="bg-brand text-[12px] font-bold text-white">
        {initials(user.name, user.email)}
      </AvatarFallback>
    </Avatar>
  )
}

export function UserMenu({ user }: { user: SessionUser }) {

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full p-0" aria-label="Account menu" />
        }
      >
        <UserAvatar user={user} className="size-10" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2">
            <UserAvatar user={user} className="size-9" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-ink">{user.name ?? "You"}</p>
                {user.isGuest && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                    Guest
                  </Badge>
                )}
              </div>
              <p className="truncate text-meta text-ink-muted">{user.email}</p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOutAction()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
