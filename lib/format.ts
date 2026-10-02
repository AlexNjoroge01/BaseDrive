import {
  differenceInCalendarDays,
  format,
  isSameYear,
  isToday,
  isYesterday,
  formatDistanceToNowStrict,
} from "date-fns"

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / 1024 ** i
  return `${i === 0 ? v : v.toFixed(v >= 100 ? 0 : digits)} ${units[i]}`
}

/** "Today 14:02", "Yesterday", "Tue", then "12 Sep", then "12 Sep 2025". */
export function formatModified(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input
  if (isToday(d)) return `Today ${format(d, "HH:mm")}`
  if (isYesterday(d)) return "Yesterday"
  if (differenceInCalendarDays(new Date(), d) < 7) return format(d, "EEEE")
  if (isSameYear(d, new Date())) return format(d, "d MMM")
  return format(d, "d MMM yyyy")
}

export function formatFull(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input
  return format(d, "d MMM yyyy, HH:mm")
}

export function timeAgo(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input
  return formatDistanceToNowStrict(d, { addSuffix: true })
}

export function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || "?").trim()
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function firstName(name?: string | null, email?: string | null) {
  return (name || email || "").split(/[\s@]/)[0]
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}
