import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { DriveShell } from "@/components/shell/drive-shell"

export default async function DriveLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { id, name, email, image, isGuest } = session.user
  return (
    <DriveShell user={{ id, name, email, image, isGuest }}>
      {children}
    </DriveShell>
  )
}
