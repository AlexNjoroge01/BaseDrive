/**
 * Materialized path helpers. A path is "/rootId/.../thisId/": every ancestor
 * id in order, then the item's own id, slash-delimited with a trailing slash.
 * Pure functions so they're cheap to unit test.
 */

export function buildPath(parentPath: string | null, id: string): string {
  return `${parentPath ?? "/"}${id}/`
}

/** Ancestor ids from root to direct parent (excludes the item itself). */
export function ancestorIds(path: string): string[] {
  const ids = path.split("/").filter(Boolean)
  return ids.slice(0, -1)
}

/** All ids on the path including the item itself, root first. */
export function pathIds(path: string): string[] {
  return path.split("/").filter(Boolean)
}

export function isDescendantOrSelf(candidatePath: string, ancestorPath: string) {
  return candidatePath.startsWith(ancestorPath)
}

/**
 * A folder can't move into itself or anything below it.
 * `targetPath` null means the root, which is always allowed.
 */
export function canMoveInto(itemPath: string, targetPath: string | null) {
  if (targetPath === null) return true
  return !isDescendantOrSelf(targetPath, itemPath)
}

/** New path for a node in a moved subtree. */
export function rewritePath(
  path: string,
  oldPrefix: string,
  newPrefix: string
): string {
  if (!path.startsWith(oldPrefix)) {
    throw new Error(`Path ${path} is not under ${oldPrefix}`)
  }
  return newPrefix + path.slice(oldPrefix.length)
}

/** Escape LIKE wildcards in a literal prefix (ids are cuids, but be safe). */
export function likePrefix(prefix: string) {
  return prefix.replace(/[\\%_]/g, (c) => `\\${c}`) + "%"
}
