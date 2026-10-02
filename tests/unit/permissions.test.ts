import { describe, expect, it, vi } from "vitest"

// resolveRole is pure; stub the DB/auth modules permissions.ts imports.
vi.mock("@/db", () => ({ db: {} }))
vi.mock("@/lib/api", () => ({
  notFound: () => new Error("not found"),
  ApiError: class extends Error {},
}))

const { resolveRole, can, maxRole } = await import("@/lib/permissions")
type LinkInput = NonNullable<Parameters<typeof resolveRole>[0]["link"]>

const owner = "owner0000000000000000000"
const alice = "alice0000000000000000000"
const bob = "bob000000000000000000000"

// /root/clients/acme/brief
const root = { id: "root", ownerId: owner, path: "/root/" }
const clients = { id: "clients", ownerId: owner, path: "/root/clients/" }
const acme = { id: "acme", ownerId: owner, path: "/root/clients/acme/" }
const brief = { id: "brief", ownerId: owner, path: "/root/clients/acme/brief/" }

const link = (over: Partial<LinkInput> = {}) => ({
  itemId: "clients",
  role: "VIEWER" as const,
  expiresAt: null,
  revokedAt: null,
  passwordHash: null,
  ...over,
})

describe("resolveRole", () => {
  it("owner is OWNER", () => {
    expect(resolveRole({ item: brief, userId: owner, grants: [] })).toBe("OWNER")
  })

  it("no grant and no link → null (caller returns 404)", () => {
    expect(resolveRole({ item: brief, userId: alice, grants: [] })).toBeNull()
    expect(resolveRole({ item: brief, userId: null, grants: [] })).toBeNull()
  })

  it("direct grant applies", () => {
    const grants = [{ itemId: "brief", userId: alice, role: "VIEWER" as const }]
    expect(resolveRole({ item: brief, userId: alice, grants })).toBe("VIEWER")
  })

  it("grant on an ancestor is inherited down the tree", () => {
    const grants = [{ itemId: "clients", userId: alice, role: "EDITOR" as const }]
    expect(resolveRole({ item: brief, userId: alice, grants })).toBe("EDITOR")
    expect(resolveRole({ item: acme, userId: alice, grants })).toBe("EDITOR")
  })

  it("grant below the item does not leak upward", () => {
    const grants = [{ itemId: "acme", userId: alice, role: "EDITOR" as const }]
    expect(resolveRole({ item: clients, userId: alice, grants })).toBeNull()
    expect(resolveRole({ item: root, userId: alice, grants })).toBeNull()
  })

  it("highest of several grants wins", () => {
    const grants = [
      { itemId: "root", userId: alice, role: "VIEWER" as const },
      { itemId: "acme", userId: alice, role: "EDITOR" as const },
    ]
    expect(resolveRole({ item: brief, userId: alice, grants })).toBe("EDITOR")
  })

  it("another user's grant doesn't count", () => {
    const grants = [{ itemId: "clients", userId: bob, role: "EDITOR" as const }]
    expect(resolveRole({ item: brief, userId: alice, grants })).toBeNull()
  })

  it("valid link on an ancestor gives the link's role, signed in or not", () => {
    expect(resolveRole({ item: brief, userId: null, grants: [], link: link() })).toBe("VIEWER")
    expect(
      resolveRole({ item: brief, userId: alice, grants: [], link: link({ role: "EDITOR" }) })
    ).toBe("EDITOR")
  })

  it("link to a sibling subtree grants nothing", () => {
    const other = { id: "invoices", ownerId: owner, path: "/root/invoices/" }
    expect(resolveRole({ item: other, userId: null, grants: [], link: link() })).toBeNull()
  })

  it("expired link grants nothing", () => {
    const now = new Date("2026-01-10T00:00:00Z")
    const expired = link({ expiresAt: new Date("2026-01-09T00:00:00Z") })
    expect(resolveRole({ item: brief, userId: null, grants: [], link: expired, now })).toBeNull()
    const fresh = link({ expiresAt: new Date("2026-01-11T00:00:00Z") })
    expect(resolveRole({ item: brief, userId: null, grants: [], link: fresh, now })).toBe("VIEWER")
  })

  it("revoked link grants nothing", () => {
    const revoked = link({ revokedAt: new Date() })
    expect(resolveRole({ item: brief, userId: null, grants: [], link: revoked })).toBeNull()
  })

  it("password link needs the password proven", () => {
    const locked = link({ passwordHash: "$2b$hash" })
    expect(resolveRole({ item: brief, userId: null, grants: [], link: locked })).toBeNull()
    expect(
      resolveRole({ item: brief, userId: null, grants: [], link: { ...locked, passwordOk: true } })
    ).toBe("VIEWER")
  })

  it("grant and link combine to the higher role", () => {
    const grants = [{ itemId: "root", userId: alice, role: "VIEWER" as const }]
    expect(
      resolveRole({ item: brief, userId: alice, grants, link: link({ role: "EDITOR" }) })
    ).toBe("EDITOR")
  })
})

describe("can", () => {
  it("matches the permission table", () => {
    expect(can("VIEWER", "view")).toBe(true)
    expect(can("VIEWER", "edit")).toBe(false)
    expect(can("EDITOR", "edit")).toBe(true)
    expect(can("EDITOR", "share")).toBe(false)
    expect(can("EDITOR", "delete")).toBe(false)
    expect(can("OWNER", "share")).toBe(true)
    expect(can("OWNER", "delete")).toBe(true)
    expect(can(null, "view")).toBe(false)
  })
})

describe("maxRole", () => {
  it("orders VIEWER < EDITOR < OWNER", () => {
    expect(maxRole("VIEWER", "EDITOR")).toBe("EDITOR")
    expect(maxRole("OWNER", "EDITOR")).toBe("OWNER")
    expect(maxRole(null, "VIEWER")).toBe("VIEWER")
    expect(maxRole(null, null)).toBeNull()
  })
})
