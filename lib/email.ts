import { Resend } from "resend"
import { env } from "@/lib/env"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function sendShareEmail(opts: {
  to: string
  sharerName: string
  itemName: string
  itemType: "FILE" | "FOLDER"
  role: "VIEWER" | "EDITOR"
  url: string
}) {
  const what = opts.itemType === "FOLDER" ? "a folder" : "a file"
  const subject = `${opts.sharerName} shared ${what} with you: ${opts.itemName}`
  if (!resend) {
    console.info(`[email] (RESEND_API_KEY unset) ${opts.to}: ${subject}`)
    return
  }
  const html = `
  <div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#16202A">
    <div style="font-weight:700;font-size:15px;margin-bottom:24px">BaseDrive</div>
    <p style="font-size:15px;line-height:22px;margin:0 0 16px">
      <strong>${escape(opts.sharerName)}</strong> shared ${what} with you as ${opts.role === "EDITOR" ? "an editor" : "a viewer"}.
    </p>
    <div style="border:1px solid #DDE3E9;border-radius:8px;padding:14px 16px;font-size:14px;margin-bottom:24px">${escape(opts.itemName)}</div>
    <a href="${opts.url}" style="display:inline-block;background:#2B4ACB;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 16px;border-radius:6px">Open in BaseDrive</a>
    <p style="font-size:12px;color:#5B6875;margin-top:32px">You're getting this because someone shared an item with ${escape(opts.to)} on ${escape(new URL(env.appUrl).host)}.</p>
  </div>`
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "BaseDrive <onboarding@resend.dev>",
      to: opts.to,
      subject,
      html,
    })
  } catch (err) {
    // A failed notification never fails the share itself.
    console.error("[email] share notification failed", err)
  }
}
