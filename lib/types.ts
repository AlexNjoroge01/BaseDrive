/** Wire types shared by API routes and the client. */

export type Role = "VIEWER" | "EDITOR"
export type FolderColor = "blue" | "coral" | "sun" | "mint" | "violet" | "aqua"
export type EffectiveRole = "OWNER" | Role

export type PersonDTO = {
  id: string
  name: string | null
  email: string
  image: string | null
}

export type ItemDTO = {
  id: string
  name: string
  type: "FILE" | "FOLDER"
  mimeType: string | null
  size: number
  status: "UPLOADING" | "READY" | "FAILED"
  parentId: string | null
  owner: PersonDTO
  createdAt: string
  updatedAt: string
  trashedAt: string | null
  hasThumbnail: boolean
  /** Folders: user-picked colour and pin. */
  color: FolderColor
  pinned: boolean
  /** Folders: files and bytes in the subtree. */
  fileCount?: number
  totalSize?: number
  shared: boolean
  starred: boolean
  /** Viewer's role on this item, when known. */
  role?: EffectiveRole
  /** Human path for search results ("My Drive / Clients"). */
  location?: string
}

export type Crumb = { id: string | null; name: string; href: string }

export type FolderListing = {
  folder: ItemDTO | null
  role: EffectiveRole
  breadcrumbs: Crumb[]
  items: ItemDTO[]
}

export type ItemDetails = {
  item: ItemDTO
  role: EffectiveRole
  breadcrumbs: Crumb[]
}

export type AccessEntry = {
  user: PersonDTO
  role: EffectiveRole
  /** Set when access comes from a parent folder. */
  via?: { id: string; name: string }
}

export type LinkDTO = {
  id: string
  url: string
  role: Role
  expiresAt: string | null
  hasPassword: boolean
  createdAt: string
}

export type AccessInfo = {
  owner: PersonDTO
  entries: AccessEntry[]
  link: LinkDTO | null
  canShare: boolean
}

export type UsageDTO = {
  used: number
  quota: number
  byKind: { kind: string; bytes: number }[]
}

export type ApiErrorBody = {
  error: { code: string; message: string; [k: string]: unknown }
}
