import { describe, expect, it } from "vitest"
import {
  ancestorIds,
  buildPath,
  canMoveInto,
  isDescendantOrSelf,
  likePrefix,
  pathIds,
  rewritePath,
} from "@/lib/paths"

describe("paths", () => {
  it("builds materialized paths", () => {
    expect(buildPath(null, "a")).toBe("/a/")
    expect(buildPath("/a/", "b")).toBe("/a/b/")
    expect(buildPath("/a/b/", "c")).toBe("/a/b/c/")
  })

  it("parses ancestors", () => {
    expect(ancestorIds("/a/b/c/")).toEqual(["a", "b"])
    expect(ancestorIds("/a/")).toEqual([])
    expect(pathIds("/a/b/c/")).toEqual(["a", "b", "c"])
  })

  it("detects descendants without prefix false positives", () => {
    expect(isDescendantOrSelf("/a/b/", "/a/")).toBe(true)
    expect(isDescendantOrSelf("/a/", "/a/")).toBe(true)
    // "/ab/" starts with "/a" but not "/a/": the trailing slash matters
    expect(isDescendantOrSelf("/ab/", "/a/")).toBe(false)
  })
})

describe("move-into-self rejection", () => {
  it("rejects moving a folder into itself", () => {
    expect(canMoveInto("/a/b/", "/a/b/")).toBe(false)
  })
  it("rejects moving a folder into its own descendant", () => {
    expect(canMoveInto("/a/b/", "/a/b/c/")).toBe(false)
    expect(canMoveInto("/a/b/", "/a/b/c/d/")).toBe(false)
  })
  it("allows siblings, parents and root", () => {
    expect(canMoveInto("/a/b/", "/a/c/")).toBe(true)
    expect(canMoveInto("/a/b/c/", "/a/")).toBe(true)
    expect(canMoveInto("/a/b/", null)).toBe(true)
    expect(canMoveInto("/a/b/", "/a/bb/")).toBe(true)
  })
})

describe("subtree path rewrite", () => {
  it("rewrites every node under the moved prefix", () => {
    const old = "/a/b/"
    const next = "/x/b/"
    const subtree = ["/a/b/", "/a/b/c/", "/a/b/c/d/"]
    expect(subtree.map((p) => rewritePath(p, old, next))).toEqual(["/x/b/", "/x/b/c/", "/x/b/c/d/"])
  })
  it("moving to root", () => {
    expect(rewritePath("/a/b/c/", "/a/b/", "/b/")).toBe("/b/c/")
  })
  it("refuses paths outside the subtree", () => {
    expect(() => rewritePath("/z/", "/a/", "/b/")).toThrow()
  })
  it("escapes LIKE wildcards in prefixes", () => {
    expect(likePrefix("/a_b/")).toBe("/a\\_b/%")
    expect(likePrefix("/a%/")).toBe("/a\\%/%")
  })
})
