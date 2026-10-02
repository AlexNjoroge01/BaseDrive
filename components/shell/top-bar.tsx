"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { CircleHelp, Monitor, Moon, Rows3, Search, Settings, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Wordmark } from "@/components/shell/logo"
import { useDialogs, usePrefs } from "@/stores/ui-store"
import { UserMenu, type SessionUser } from "@/components/shell/user-menu"
import { useIsMac } from "@/hooks/use-platform"

const SHORTCUTS: [string, string[]][] = [
  ["Search", ["⌘", "K"]],
  ["Open", ["Enter"]],
  ["Rename", ["F2"]],
  ["Move to trash", ["Del"]],
  ["Details panel", ["I"]],
  ["Select all", ["⌘", "A"]],
  ["Clear selection", ["Esc"]],
  ["Upload files", ["U"]],
  ["New folder", ["⇧", "N"]],
  ["Toggle theme", ["D"]],
]

function CircleButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button variant="secondary" size="icon" aria-label={label} className="text-ink-muted hover:text-ink" {...props}>
      {children}
    </Button>
  )
}

function SettingsMenu() {
  const { theme, setTheme } = useTheme()
  const compact = usePrefs((s) => s.compact)
  const setCompact = usePrefs((s) => s.setCompact)
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Settings"
                  className="hidden text-ink-muted hover:text-ink sm:inline-flex"
                />
              }
            />
          }
        >
          <Settings className="size-[18px]" />
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
            <DropdownMenuRadioItem value="light">
              <Sun /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon /> Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor /> System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={compact} onCheckedChange={(v) => setCompact(!!v)}>
          <Rows3 /> Compact rows
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 72px header on --page: logo, pill search, help, settings, avatar. */
export function TopBar({ user }: { user: SessionUser }) {
  const openDialog = useDialogs((s) => s.open)
  const isMac = useIsMac()
  const mod = isMac ? "⌘" : "Ctrl"

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-page px-4 sm:h-[72px] sm:px-6">
      <Link href="/drive" className="shrink-0 rounded-lg sm:w-[236px]" aria-label="BaseDrive home">
        <Wordmark />
      </Link>
      <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
        <button
          type="button"
          onClick={() => openDialog("searchOpen", true)}
          className="group hidden h-11 w-full max-w-[560px] items-center gap-3 rounded-full bg-surface px-5 text-left text-ink-faint transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--surface),var(--ink)_4%)] focus-visible:bg-page focus-visible:ring-2 focus-visible:ring-focus sm:flex"
          aria-label="Search your drive"
        >
          <Search className="size-[18px] text-ink-muted" />
          <span className="flex-1 truncate text-[14px] font-medium">Search your drive</span>
          <KbdGroup>
            <Kbd className="bg-page">{mod}</Kbd>
            <Kbd className="bg-page">K</Kbd>
          </KbdGroup>
        </button>
        <CircleButton label="Search" className="sm:hidden" onClick={() => openDialog("searchOpen", true)}>
          <Search className="size-[18px]" />
        </CircleButton>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Popover>
          <Tooltip>
            <TooltipTrigger
              render={
                <PopoverTrigger
                  render={
                    <Button
                      variant="secondary"
                      size="icon"
                      className="hidden text-ink-muted hover:text-ink sm:inline-flex"
                      aria-label="Keyboard shortcuts"
                    />
                  }
                />
              }
            >
              <CircleHelp className="size-[18px]" />
            </TooltipTrigger>
            <TooltipContent>Keyboard shortcuts</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-72 gap-0 rounded-xl p-0">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[15px] font-bold text-ink">Keyboard shortcuts</p>
            </div>
            <Separator />
            <ul className="space-y-0.5 p-2">
              {SHORTCUTS.map(([label, keys]) => (
                <li key={label} className="flex items-center justify-between rounded-md px-2 py-1.5 text-meta">
                  <span className="text-ink-muted">{label}</span>
                  <KbdGroup>
                    {keys.map((k) => (
                      <Kbd key={k}>{k === "⌘" ? mod : k}</Kbd>
                    ))}
                  </KbdGroup>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
        <SettingsMenu />
        <UserMenu user={user} />
      </div>
    </header>
  )
}
