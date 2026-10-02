import { expect, test } from "@playwright/test"

/**
 * Blueprint §14: guest login → upload → create folder → move → share link
 * → open in a fresh (incognito) context → trash → restore.
 */
test("guest can upload, organise, share and restore", async ({ page, browser }) => {
  const stamp = Date.now().toString(36)
  const folder = `E2E folder ${stamp}`
  const file = `e2e-${stamp}.txt`
  // Items, not toasts (which also mention names).
  const item = (name: string) => page.locator("[data-item-id]", { hasText: name }).first()

  await page.goto("/login")
  await page.getByRole("button", { name: "Try as guest" }).click()
  // Generous: the first hit may wake a scaled-to-zero Neon DB and seed the demo drive.
  await expect(page).toHaveURL(/\/drive$/, { timeout: 60_000 })
  await expect(page.getByRole("heading", { name: "My Drive" })).toBeVisible()

  // Upload through the real multipart flow (browser → presigned PUT → MinIO).
  await page.getByTestId("file-input").first().setInputFiles({
    name: file,
    mimeType: "text/plain",
    buffer: Buffer.from(`hello from ${stamp}\n`),
  })
  await expect(page.getByRole("region", { name: "Uploads" })).toContainText(/upload(s)? complete/i, {
    timeout: 45_000,
  })
  await expect(page.getByRole("row", { name: new RegExp(file) })).toBeVisible()

  // New folder
  await page.keyboard.press("Shift+N")
  await page.getByLabel("Folder name").fill(folder)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(item(folder)).toBeVisible()

  // Move file into the folder via Move to…
  await page.getByRole("row", { name: new RegExp(file) }).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Move to…" }).click()
  await page.getByRole("treeitem", { name: folder }).click()
  await page.getByRole("button", { name: `Move to ${folder}` }).click()
  await expect(page.getByRole("row", { name: new RegExp(file) })).toHaveCount(0)

  // Share the folder with a public link
  await item(folder).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Share…" }).click()
  await page.getByRole("combobox", { name: "Link access" }).click()
  await page.getByRole("option", { name: "Anyone with the link" }).click()
  await expect(page.getByText(/Created/)).toBeVisible()
  const access = await page.evaluate(async (name) => {
    const list = await fetch("/api/items").then((r) => r.json())
    const f = list.items.find((i: { name: string }) => i.name === name)
    return fetch(`/api/items/${f.id}/access`).then((r) => r.json())
  }, folder)
  await page.getByRole("button", { name: "Done" }).click()

  // Open the link with no session (incognito)
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  await anonPage.goto(access.link.url.replace(/^https?:\/\/[^/]+/, ""))
  await expect(anonPage.getByRole("heading", { name: folder })).toBeVisible()
  await expect(anonPage.getByText(file)).toBeVisible()
  await anon.close()

  // Trash → restore
  await item(folder).click()
  await page.keyboard.press("Delete")
  await expect(page.getByText("Moved to trash")).toBeVisible()
  await page.goto("/trash")
  await item(folder).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Restore" }).click()
  await expect(page.getByText(/Restored to/)).toBeVisible()
  await page.goto("/drive")
  await expect(item(folder)).toBeVisible()
})
