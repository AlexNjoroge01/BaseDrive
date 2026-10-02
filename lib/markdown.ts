/**
 * Tiny, safe markdown → HTML for previews. Everything is escaped first, so the
 * only HTML in the output is what this function writes.
 */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function inline(s: string) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
}

export function renderMarkdown(src: string): string {
  const lines = esc(src).split(/\r?\n/)
  const out: string[] = []
  let list: "ul" | "ol" | null = null
  let code = false
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const line of lines) {
    if (line.startsWith("```")) {
      closeList()
      out.push(code ? "</code></pre>" : "<pre><code>")
      code = !code
      continue
    }
    if (code) {
      out.push(line + "\n")
      continue
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line)
    const ul = /^\s*[-*]\s+(.*)$/.exec(line)
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (h) {
      closeList()
      out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    } else if (ul || ol) {
      const kind = ul ? "ul" : "ol"
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`)
    } else if (!line.trim()) {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  if (code) out.push("</code></pre>")
  return out.join("")
}
