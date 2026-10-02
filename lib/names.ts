/** File name sanitization: no slashes, no control chars, max 255. */
export function sanitizeName(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "-")
    .trim()
  if (!cleaned || cleaned === "." || cleaned === "..") return ""
  return cleaned.slice(0, 255)
}

export function splitExt(name: string): { base: string; ext: string } {
  const i = name.lastIndexOf(".")
  if (i <= 0 || i === name.length - 1) return { base: name, ext: "" }
  return { base: name.slice(0, i), ext: name.slice(i) }
}

/** "Budget.xlsx" → "Budget (1).xlsx", skipping names already taken. */
export function nextAvailableName(name: string, taken: Set<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  const { base, ext } = splitExt(name)
  for (let n = 1; n < 10_000; n++) {
    const candidate = `${base} (${n})${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
  return `${base} (${Date.now()})${ext}`
}
