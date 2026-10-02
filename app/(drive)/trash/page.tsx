import type { Metadata } from "next"
import { ListView } from "@/components/drive/list-view"

export const metadata: Metadata = { title: "Trash" }

export default function Page() {
  return <ListView kind="trash" />
}
