import { describe, expect, it } from "vitest"
import { nextAvailableName, sanitizeName, splitExt } from "@/lib/names"
import { formatBytes } from "@/lib/format"
import { fileKind, previewMode } from "@/lib/file-types"
import { renderMarkdown } from "@/lib/markdown"
import { hashToken, linkToken } from "@/lib/tokens"

describe("sanitizeName", () => {
  it("strips control chars and slashes, trims, caps at 255", () => {
    expect(sanitizeName("  a\u0000b\u001fc  ")).toBe("abc")
    expect(sanitizeName("a/b\\c")).toBe("a-b-c")
    expect(sanitizeName("x".repeat(300))).toHaveLength(255)
  })
  it("rejects empty and dot names", () => {
    expect(sanitizeName("   ")).toBe("")
    expect(sanitizeName(".")).toBe("")
    expect(sanitizeName("..")).toBe("")
  })
})

describe("names", () => {
  it("splits extensions", () => {
    expect(splitExt("Budget.xlsx")).toEqual({ base: "Budget", ext: ".xlsx" })
    expect(splitExt(".env")).toEqual({ base: ".env", ext: "" })
    expect(splitExt("archive.tar.gz")).toEqual({ base: "archive.tar", ext: ".gz" })
  })
  it("finds the next free name, case-insensitively", () => {
    expect(nextAvailableName("a.txt", new Set())).toBe("a.txt")
    expect(nextAvailableName("a.txt", new Set(["A.TXT"]))).toBe("a (1).txt")
    expect(nextAvailableName("a.txt", new Set(["a.txt", "a (1).txt"]))).toBe("a (2).txt")
  })
})

describe("quota math / formatting", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(524_288_000)).toBe("500 MB")
    expect(formatBytes(104_857_600)).toBe("100 MB")
  })
})

describe("file types", () => {
  it("classifies by extension, then MIME", () => {
    expect(fileKind("Budget.xlsx")).toBe("sheet")
    expect(fileKind("photo", "image/png")).toBe("image")
    expect(fileKind("x", null, "FOLDER")).toBe("folder")
    expect(fileKind("mystery.bin", "application/octet-stream")).toBe("other")
  })
  it("never previews SVG inline (stored XSS)", () => {
    expect(previewMode("logo.svg", "image/svg+xml")).toBe("none")
    expect(previewMode("a.png", "image/png")).toBe("image")
    expect(previewMode("notes.md", "text/markdown")).toBe("text")
  })
})

describe("markdown preview", () => {
  it("escapes HTML", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> **hi**')
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    expect(html).toContain("<strong>hi</strong>")
  })
  it("only links http(s)", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("href")
    expect(renderMarkdown("[x](https://a.b)")).toContain('href="https://a.b"')
  })
})

describe("share tokens", () => {
  it("are deterministic per link id and stored only as a hash", () => {
    const t1 = linkToken("link1")
    expect(linkToken("link1")).toBe(t1)
    expect(linkToken("link2")).not.toBe(t1)
    expect(Buffer.from(t1, "base64url")).toHaveLength(32)
    expect(hashToken(t1)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashToken(t1)).not.toContain(t1)
  })
})
