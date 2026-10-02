import { BrandPanel } from "@/components/auth/brand-panel"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-page lg:flex-row">
      <BrandPanel />
      <main className="flex flex-1 flex-col px-6 py-8 sm:px-10">{children}</main>
    </div>
  )
}
