"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Clock, HardDrive, Star, Trash2, Users, type LucideIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { NewMenu } from "@/components/shell/new-menu"
import { StorageMeter, StorageRing } from "@/components/shell/storage-meter"
import { useDropTarget } from "@/components/drive/drag-and-drop"
import { cn } from "@/lib/utils"

export const NAV: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/drive", label: "My Drive", icon: HardDrive, match: (p) => p.startsWith("/drive") },
  { href: "/shared", label: "Shared with me", icon: Users, match: (p) => p === "/shared" },
  { href: "/recent", label: "Recent", icon: Clock, match: (p) => p === "/recent" },
  { href: "/starred", label: "Starred", icon: Star, match: (p) => p === "/starred" },
  { href: "/trash", label: "Trash", icon: Trash2, match: (p) => p === "/trash" },
]

/**
 * The scooped sidebar: a solid blue column whose top-right corner sweeps out
 * in a 56px curve (32px on the tablet rail). It starts below the header.
 */
export function AppSidebar({ isGuest, rail }: { isGuest: boolean; rail: boolean }) {
  const pathname = usePathname()
  // Dropping onto "My Drive" moves items to the root.
  const rootDrop = useDropTarget({ id: null, name: "My Drive" })

  return (
    <Sidebar
      collapsible="none"
      className={cn(
        "on-brand-focus h-full shrink-0 bg-sidebar-fill text-white transition-[width,border-radius] duration-200",
        rail ? "w-[76px] rounded-tr-[32px]" : "w-[260px] rounded-tr-[var(--radius-scoop)]"
      )}
    >
      <SidebarHeader className={cn("gap-0 pt-7 pb-4", rail ? "items-center px-0" : "px-3")}>
        <NewMenu collapsed={rail} />
        {isGuest && !rail && (
          <Badge className="mt-3 ml-1 h-6 bg-white/15 px-2.5 text-white">Demo drive · resets daily</Badge>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className={cn(rail ? "px-0" : "px-3")}>
          <SidebarMenu className={cn("gap-1", rail && "items-center")}>
            {NAV.map((item) => {
              const active = item.match(pathname)
              const isRoot = item.href === "/drive"
              const over = isRoot && rootDrop.isOver
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={rail ? item.label : undefined}
                    className={cn(
                      "h-11 gap-3 rounded-full px-4 text-[15px] font-semibold text-white/90 transition-colors",
                      "hover:bg-white/12 hover:text-white active:bg-white/12 active:text-white",
                      "data-active:bg-white data-active:text-brand data-active:hover:bg-white data-active:hover:text-brand dark:data-active:text-brand-deep",
                      rail && "size-11 justify-center p-0",
                      over && "bg-white/25 ring-2 ring-white"
                    )}
                    render={<Link href={item.href} {...(isRoot ? rootDrop.props : {})} />}
                  >
                    <item.icon className="size-5!" strokeWidth={active ? 2.25 : 2} />
                    {!rail && <span>{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={cn("pb-6", rail ? "items-center px-0" : "px-5")}>
        {rail ? (
          <StorageRing />
        ) : (
          <>
            <div className="mb-3 h-px bg-white/20" />
            <StorageMeter />
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
