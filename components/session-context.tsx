"use client"

import * as React from "react"
import type { SessionUser } from "@/components/shell/user-menu"

const SessionContext = React.createContext<SessionUser | null>(null)

export function SessionProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
}

export function useSessionUser() {
  const user = React.useContext(SessionContext)
  if (!user) throw new Error("useSessionUser outside SessionProvider")
  return user
}
