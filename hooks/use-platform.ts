"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

export function useIsMac() {
  return useSyncExternalStore(
    subscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => true
  )
}
