import { Suspense } from "react"
import type { Metadata } from "next"
import { DriveView } from "./drive-view"

export const metadata: Metadata = { title: "My Drive" }

export default async function DrivePage(props: PageProps<"/drive/[[...folderId]]">) {
  const { folderId } = await props.params
  return (
    <Suspense>
      <DriveView folderId={folderId?.[0] ?? null} />
    </Suspense>
  )
}
