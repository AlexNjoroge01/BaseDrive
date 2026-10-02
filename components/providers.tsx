"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "framer-motion"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { bindUploader } from "@/lib/client/uploader"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, refetchOnWindowFocus: true },
        },
      })
  )

  React.useEffect(() => bindUploader(queryClient), [queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delay={400}>
          {children}
          {/* Bottom-left so toasts never cover the upload dock. */}
          <Toaster position="bottom-left" closeButton={false} />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  )
}
