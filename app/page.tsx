import { redirect } from "next/navigation"

// proxy.ts routes "/" by session; this is the fallback.
export default function Home() {
  redirect("/drive")
}
