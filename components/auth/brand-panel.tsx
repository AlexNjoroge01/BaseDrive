import { Folder } from "lucide-react"
import { FolderShape } from "@/components/drive/folder-shape"
import { folderTextClass } from "@/lib/folder-colors"
import { Wordmark } from "@/components/shell/logo"
import type { FolderColor } from "@/lib/types"

const CARDS: { name: string; meta: string; color: FolderColor; solid: boolean; offset: string }[] = [
  { name: "Clients", meta: "24 files · 1.2 GB", color: "blue", solid: true, offset: "ml-0" },
  { name: "Invoices", meta: "9 files · 4 MB", color: "coral", solid: false, offset: "ml-16" },
  { name: "Brand assets", meta: "41 files · 310 MB", color: "mint", solid: false, offset: "ml-32" },
]

/**
 * Sign-in brand panel: the blue slab with the 56px scoop (top-right on
 * desktop, bottom-right as a band on mobile) and a stack of folder cards.
 */
export function BrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative flex h-[200px] shrink-0 flex-col justify-between overflow-hidden rounded-br-[56px] bg-sidebar-fill px-6 py-6 text-white lg:h-auto lg:w-1/2 lg:rounded-br-none lg:rounded-tr-[56px] lg:px-16 lg:py-14 xl:px-24"
    >
      <Wordmark inverted />
      <div className="lg:mb-10">
        <p className="max-w-md text-[26px] leading-[32px] font-extrabold tracking-[-0.02em] lg:text-[36px] lg:leading-[44px]">
          Your files, one place.
        </p>
        <p className="mt-3 hidden max-w-sm text-[15px] leading-[22px] text-white/80 lg:block">
          Drop a file in, find it again, send it on. Folders get their own colours, so the ones you
          use most are easy to spot.
        </p>
      </div>
      <div className="hidden space-y-4 lg:block">
        {CARDS.map((c) => (
          <FolderShape
            key={c.name}
            color={c.color}
            solid={c.solid}
            className={`h-[120px] w-[280px] ${c.offset}`}
            // A blue card would vanish on the blue panel: the featured card is white with blue ink.
            style={
              c.solid
                ? ({ "--folder-solid": "#ffffff", "--folder-on": "var(--brand)" } as React.CSSProperties)
                : undefined
            }
          >
            <div className={`flex h-full flex-col justify-between px-5 pt-7 pb-4 ${folderTextClass(c.solid)}`}>
              <Folder
                className={c.solid ? "size-6" : "size-6 text-[var(--folder-solid)]"}
                fill="currentColor"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <div>
                <p className="text-[15px] font-bold">{c.name}</p>
                <p className="text-small font-medium opacity-80">{c.meta}</p>
              </div>
            </div>
          </FolderShape>
        ))}
      </div>
    </aside>
  )
}
