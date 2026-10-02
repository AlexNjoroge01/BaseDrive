export type FileKind =
  | "folder"
  | "doc"
  | "sheet"
  | "slides"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "code"
  | "other"

export const KIND_LABEL: Record<FileKind, string> = {
  folder: "Folder",
  doc: "Document",
  sheet: "Spreadsheet",
  slides: "Slides",
  pdf: "PDF",
  image: "Image",
  video: "Video",
  audio: "Audio",
  archive: "Archive",
  code: "Code",
  other: "Other",
}

/** Plural labels for filters and the storage legend. */
export const KIND_PLURAL: Record<FileKind, string> = {
  folder: "Folders",
  doc: "Documents",
  sheet: "Spreadsheets",
  slides: "Slides",
  pdf: "PDFs",
  image: "Images",
  video: "Videos",
  audio: "Audio",
  archive: "Archives",
  code: "Code",
  other: "Other",
}

const EXT: Record<string, FileKind> = {}
const add = (kind: FileKind, exts: string) =>
  exts.split(" ").forEach((e) => (EXT[e] = kind))
add("doc", "doc docx txt md markdown rtf odt pages")
add("sheet", "xls xlsx csv tsv ods numbers")
add("slides", "ppt pptx key odp")
add("pdf", "pdf")
add("image", "png jpg jpeg gif webp svg avif heic bmp tiff ico")
add("video", "mp4 mov webm mkv avi m4v")
add("audio", "mp3 wav ogg flac m4a aac opus")
add("archive", "zip tar gz tgz rar 7z bz2 xz")
add(
  "code",
  "js jsx ts tsx mjs cjs json html css scss py rb go rs java kt swift c h cpp cs php sh yml yaml toml xml sql dockerfile"
)

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".")
  return i > 0 ? name.slice(i + 1).toLowerCase() : ""
}

export function fileKind(
  name: string,
  mimeType?: string | null,
  type?: "FILE" | "FOLDER"
): FileKind {
  if (type === "FOLDER") return "folder"
  const byExt = EXT[extensionOf(name)]
  if (byExt) return byExt
  const m = mimeType ?? ""
  if (m.startsWith("image/")) return "image"
  if (m.startsWith("video/")) return "video"
  if (m.startsWith("audio/")) return "audio"
  if (m === "application/pdf") return "pdf"
  if (m.startsWith("text/")) return "doc"
  if (m.includes("zip") || m.includes("compressed")) return "archive"
  return "other"
}

/** Kinds offered as quick filters (search chips, type filter). */
export const FILTER_KINDS: FileKind[] = [
  "folder",
  "doc",
  "sheet",
  "slides",
  "pdf",
  "image",
  "video",
  "audio",
  "archive",
  "code",
]

/** What the preview overlay can render inline. */
export type PreviewMode = "image" | "pdf" | "video" | "audio" | "text" | "none"

export function previewMode(name: string, mimeType?: string | null): PreviewMode {
  const kind = fileKind(name, mimeType)
  const ext = extensionOf(name)
  if (kind === "image" && ext !== "svg" && ext !== "heic" && ext !== "tiff") return "image"
  if (kind === "pdf") return "pdf"
  if (kind === "video" && ["mp4", "webm", "mov", "m4v"].includes(ext)) return "video"
  if (kind === "audio") return "audio"
  if (
    kind === "code" ||
    ["txt", "md", "markdown", "csv", "tsv", "log"].includes(ext) ||
    (mimeType ?? "").startsWith("text/")
  )
    return "text"
  return "none"
}
