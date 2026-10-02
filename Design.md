# BaseDrive: Design Spec

> How BaseDrive looks, moves, and reads, in light and dark. Companion to `blueprint.md`. Built with Tailwind v4 + shadcn/ui + Lucide + Framer Motion: every token here is a CSS variable and every component maps to a shadcn primitive.

---

## 1. Design Direction

### The idea: a bright blue room with coloured folders
BaseDrive takes the friendly SaaS-dashboard look (one strong blue slab, big soft curves, pill controls, folder-shaped cards) and turns the brightness up. Two things carry the identity:

1. **The scooped sidebar.** A solid blue column whose top-right corner sweeps out in a large curve, as if a scoop was cut out of the white page. It's the first thing you see and it reads as "BaseDrive" even in a thumbnail.
2. **Folder-shaped cards in bright colours.** Pinned folders aren't rectangles: each card *is* a folder, with a raised tab. Users pick each folder's colour from six bright hues, so the Quick Access row becomes a colourful, personal shelf.

Everything else (the file list, metadata, dialogs) stays clean and quiet so the colour has somewhere to land.

### Who it's for, and its one job
- **Users:** people who need to drop a file in, find it again, and send it on. A recruiter testing the demo should do all three in 30 seconds without being told how.
- **Primary job:** *find and act on a file fast.* Colour helps you find folders; layout helps you act.

### Principles
1. **Blue is structure, brights are yours.** The brand blue builds the frame (sidebar, primary actions, focus). The six bright hues belong to the user's folders and never decorate chrome.
2. **Curves by hierarchy.** The bigger the surface, the bigger the radius. Large curves are rare, so they read as intentional.
3. **Flat by default.** No shadows on anything resting. Shape and fill do the work. Shadows only mean "floating".
4. **Both themes are first-class.** Dark mode is designed, not inverted: the sidebar stays blue, the brights stay bright.
5. **Motion answers the user.** Nothing animates on its own.

---

## 2. Colour

### Core palette
| Token | Light | Dark | Use |
|---|---|---|---|
| `--page` | `#FFFFFF` | `#0D1426` | Main content area and header |
| `--surface` | `#F3F5FB` | `#151D33` | Table header, inputs, hover rows, grey cards |
| `--surface-raised` | `#FFFFFF` | `#1C2540` | Dialogs, menus, upload dock |
| `--ink` | `#121A33` | `#EEF1FA` | Primary text |
| `--ink-muted` | `#5D6782` | `#9AA4BF` | Metadata |
| `--ink-faint` | `#97A0B8` | `#5F6A86` | Placeholders, disabled |
| `--line` | `#E4E8F2` | `#253050` | Row dividers, borders |
| `--brand` | `#2A5BF0` | `#2A5BF0` | Sidebar, primary button, title, active states |
| `--brand-deep` | `#1D46C9` | `#1B3CA8` | Sidebar in dark mode, pressed state |
| `--brand-tint` | `#E7EDFF` | `#1A2A5C` | Selected rows, active nav highlight on white |
| `--on-brand` | `#FFFFFF` | `#FFFFFF` | Text and icons on blue |
| `--focus` | `#2A5BF0` | `#7FA1FF` | Focus ring |
| `--danger` | `#E5364B` | `#FF6B7C` | Delete forever, errors |
| `--success` | `#13A672` | `#3DDC9E` | Upload complete |

Contrast checks: white on `--brand` is 5.5:1, `--ink-muted` on white is 5.7:1, and `--ink-muted` on dark `--page` is 7.6:1.

**Dark mode sidebar:** it becomes `--brand-deep` (`#1B3CA8`) so it doesn't glare against the navy page, but it stays clearly blue. The scoop curve and white text are unchanged.

### Folder colours (the bright set)
Users pick one per folder (default is Blue). Each colour has a **solid** (selected or featured card) and a **tint** (resting card), plus the text colour that passes contrast on the solid.

| Name | Solid | Text on solid | Tint (light) | Tint (dark) |
|---|---|---|---|---|
| Blue | `#2A5BF0` | white | `#E7EDFF` | `#1A2A5C` |
| Coral | `#FF6B4A` | `#121A33` | `#FFE9E3` | `#4A2219` |
| Sunflower | `#FFC93C` | `#121A33` | `#FFF5D6` | `#463815` |
| Mint | `#22C38E` | `#121A33` | `#DDF7EE` | `#123D30` |
| Violet | `#7C4DF0` | white | `#EEE7FE` | `#2E1F5C` |
| Aqua | `#1EC8E8` | `#121A33` | `#DDF7FC` | `#0F3D47` |

- On a **tinted** card, the name is in `--ink` and the folder tab and icon in the solid colour.
- In the file list, a folder's small icon uses its folder colour, so colour carries from the shelf into the list.

### File-type icons
Files use **filled** Lucide-style glyphs at 20px in a single neutral (`--ink-muted`), except for these, which get a small coloured badge in the bottom-right of the icon:

| Type | Badge |
|---|---|
| PDF | Coral |
| Spreadsheet | Mint |
| Image | Violet |
| Video | Coral |
| Slides | Sunflower |
| Document | Blue |

This keeps the list calm while the shelf above stays bright.

---

## 3. Typography

**One family: [Figtree](https://fonts.google.com/specimen/Figtree)** (Google Fonts, variable 300–900). It's a geometric sans with round, friendly forms that match the soft shapes, and it stays legible at 12–13px in dense tables. Load via `next/font/google` as `--font-sans`. Use `font-variant-numeric: tabular-nums` for sizes, dates, and storage figures.

| Role | Size / line-height | Weight | Colour |
|---|---|---|---|
| Page title ("My Drive", folder name) | 30 / 36 | 800 | `--brand` (light), `--ink` (dark) |
| Section heading ("Pinned", "Files") | 18 / 24 | 700 | `--ink` |
| Dialog title | 20 / 26 | 700 | `--ink` |
| Card name | 15 / 20 | 700 | depends on card fill |
| Body / file name | 14 / 20 | 500 | `--ink` |
| Metadata / table cells | 13 / 18 | 400 | `--ink-muted` |
| Table column header | 13 / 18 | 700 | `--ink` |
| Small (captions, kbd) | 12 / 16 | 500 | `--ink-muted` |

Rules:
- **Sentence case** everywhere, including table headers and buttons.
- The page title is in brand blue in light mode, which echoes the sidebar. In dark mode it switches to `--ink`, because blue text on navy loses weight.
- File names truncate in the **middle** so the extension stays visible: `Q3 financial rep…final.xlsx`.

---

## 4. Shape, Space, Elevation

### Radius by hierarchy
| Element | Radius |
|---|---|
| Sidebar top-right scoop | **56px** (only that corner) |
| Dialogs, preview panel | 24px |
| Folder cards | 18px body, 12px tab top corners |
| Upload dock, menus, popovers | 16px |
| Grid file tiles | 14px |
| Buttons, search, chips, segmented controls | full pill (`9999px`) |
| Inputs inside dialogs | 12px |
| Table row hover/selection | 10px |

### Space
4px base. Common steps: 4, 8, 12, 16, 20, 24, 32, 40. The content area uses 40px side padding at desktop and 16px on mobile.

### Elevation
- **Resting:** no shadows. Cards, rows, and the sidebar are flat.
- **Floating (menus, dock, popovers):** light `0 12px 32px -8px rgb(18 26 51 / .18)`; dark: no shadow, `1px solid var(--line)` + `--surface-raised`.
- **Modal:** light `0 32px 80px -16px rgb(18 26 51 / .30)`; dark: border + an 80% navy scrim.

---

## 5. App Shell

### Desktop (≥ 1024px)
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◆ BaseDrive         ( ⌕  Search your drive                  ⌘K )   ?  ⚙  (AN)│ ← 72px header, on --page
│╭──────────────╮                                                             │
││              ╲   My Drive  ▣                                  (⊞ │ ☰)      │ ← title + view toggle
││ ( ＋ New    ) │                                                             │
││              │   Pinned                                                    │
││ ▣ My Drive   │   ╭──╮              ╭──╮              ╭──╮                   │
││ ◫ Shared     │   │  ╰──────────╮   │  ╰──────────╮   │  ╰──────────╮       │
││ ◷ Recent     │   │▓▓▓▓▓▓▓▓▓▓▓▓▓│   │░░░░░░░░░░░░░│   │░░░░░░░░░░░░░│       │ ← folder cards
││ ★ Starred    │   │ Clients      │   │ Invoices     │   │ Brand assets │       │   (solid / tints)
││ ⌫ Trash      │   │ 24 files     │   │ 9 files      │   │ 41 files     │       │
││              │   ╰─────────────╯   ╰─────────────╯   ╰─────────────╯       │
││              │                                                             │
││              │   Files                         ( Type ▾ ) ( Modified ▾ )     │
││              │   Name                 Owner     Modified        Size     │
││              │   ▰ Contracts          You       Today 14:02     —      ⋮ │
││              │   ▤ Brief v3.pdf       You       12 Sep          2.4 MB ⋮ │
││              │   ▦ Budget.xlsx        Wanjiru   3 Sep           88 KB  ⋮ │
││ ──────────── │                                                             │
││ Storage      │                                                             │
││ ▬▬▬▬▬▬▬░░░░  │                                                             │
││ 312 of 500 MB│                                                             │
│╰──────────────┘                                                             │
└────────────────────────────────────────────────────────────────────────────┘
  260px blue sidebar, 56px scoop      content: left-aligned, max width 1240px
```

### The sidebar
- **Shape:** 260px wide, `--brand` fill, `border-top-right-radius: 56px`, flush to the left and bottom of the viewport. It starts **below** the header, so the logo and search sit on white above the blue. The header is on `--page`, with no border.
- **Content (all `--on-brand`):**
  - **New** button: white pill, `--brand` text, 700 weight, `Plus` icon, 44px tall, full sidebar width minus 24px padding.
  - Nav items: 44px pill rows, 20px icon + 15px/600 label. The active item is a **white pill** with `--brand` text and icon, like the New button. Hover is white at 12% opacity.
  - Storage, pinned to the bottom: a "Storage" label at 13/700, a 6px white bar at 30% opacity with a solid white fill for the used amount, and "312 MB of 500 MB used" at 12px, white at 80%.
- **Why the active state is a white pill:** it reuses the one strong shape (the pill) and puts the same white-on-blue contrast as the New button on the item you're viewing. No left stripe, no darker blue block.

### Header (72px)
- Left: the logo mark (a 28px blue rounded square holding a white folder-tab glyph) + the "BaseDrive" wordmark, 20/800, `--brand`.
- Centre: **pill search**, 44px tall, max 560px, `--surface` fill, no border, `Search` icon in `--ink-muted`, `⌘K` hint chip on the right. On focus: white fill + 2px `--focus` ring.
- Right: 40px circular icon buttons (Help, Settings) in `--surface` fill, then the 40px avatar.

### Content area
- **Title row:** the folder name (30/800, brand blue) plus a 28px rounded-square blue badge holding the current folder's icon. On the right, a pill segmented control for view (Grid / List): a `--surface` track with a white thumb.
- **Pinned shelf:** up to 4 folder cards in a row (see §6). Hidden inside subfolders, where breadcrumbs take its place.
- **Breadcrumbs (inside folders):** `My Drive › Clients › Acme`, 14/500 `--ink-muted`, last segment `--ink` 700. Each segment is a drop target.

### Tablet (640–1023px)
The sidebar collapses to a 76px blue rail. It keeps a 32px scoop, icons only, and a white-pill active state. The storage bar becomes a white ring around a small percentage figure.

### Mobile (< 640px)
```
┌─────────────────────────────┐
│ ◆ BaseDrive       ⌕   (AN)  │
├─────────────────────────────┤
│ My Drive                    │
│ ╭─╮        ╭─╮        ╭─╮   │ ← pinned shelf scrolls sideways
│ │▓╰────╮   │░╰────╮   │░╰─  │
│ │Clients│  │Invoic│   │Bra  │
│ ╰──────╯   ╰──────╯   ╰──   │
│ Files                       │
│ ▰ Contracts             ⋮   │
│ ▤ Brief v3.pdf          ⋮   │
│   12 Sep · 2.4 MB           │
│                      (＋)   │ ← 56px blue FAB
│╭───────────────────────────╮│
││ ▣ Drive  ◫ Shared  ◷ Recent││ ← blue bottom bar, 28px top corners
│╰───────────────────────────╯│
└─────────────────────────────┘
```
On mobile, the scoop moves to the bottom navigation bar, which is blue with 28px rounded top corners, so the brand shape survives the smaller screen.

---

## 6. Signature Components

### Folder card
```
 ╭────────╮
 │        ╰────────────────────╮   ← tab: 40% width, 14px tall, 12px top radii,
 │                             │      joins the body with a 10px concave curve
 │   ▰                     ⋮   │   ← folder icon (white or solid colour), kebab
 │                             │
 │   Clients                   │   ← 15/700
 │   24 files · 1.2 GB         │   ← 12/500, 80% opacity
 ╰─────────────────────────────╯
   min-width 200px, height 132px, radius 18px
```
- **Resting:** tint fill, solid-colour tab and icon, `--ink` text.
- **Selected / hover:** animates to the solid fill, with text switching to that colour's "text on solid" value (150ms).
- **Pinned by default:** the 4 most recently opened folders, until the user pins their own (**Pin to top** in the context menu).
- **Colour picker:** **Change colour** in the context menu opens a popover with six 28px swatch circles. The selected swatch gets a 2px ring in `--ink`.
- **Build:** an SVG path for the outline so the tab curve is smooth. Use the same component for the tab-shaped empty-state illustration.

```tsx
// components/drive/folder-card.tsx (shape only)
<div className="relative h-[132px] min-w-[200px]">
  <svg viewBox="0 0 200 132" preserveAspectRatio="none"
       className="absolute inset-0 h-full w-full" aria-hidden>
    <path
      d="M0 12 Q0 0 12 0 H66 Q74 0 78 6 L82 12 Q86 16 94 16
         H182 Q200 16 200 34 V114 Q200 132 182 132 H18 Q0 132 0 114 Z"
      className={selected ? "fill-[var(--folder-solid)]" : "fill-[var(--folder-tint)]"} />
  </svg>
  <div className="relative flex h-full flex-col justify-end p-4">…</div>
</div>
```
The SVG is stretched with `preserveAspectRatio="none"`, which will distort the curves on very wide cards. Keep cards between 200 and 280px wide, or render the path from measured dimensions in a `ResizeObserver`.

### Storage bar
A 6px pill track in white at 30% opacity, filled in solid white. Past 90%, the fill switches to Sunflower and the caption reads "Almost full: 46 MB left". At 100%, it switches to Coral with "Storage full".

### File list
| Column | Width | Notes |
|---|---|---|
| Checkbox | 40px | Appears on hover or once anything is selected |
| Name | flex | Folder icon in folder colour, or neutral file glyph with type badge |
| Owner | 140px | "You" or first name + 22px avatar |
| Modified | 140px | "Today 14:02", "Yesterday", "12 Sep", "12 Sep 2025" |
| Size | 96px, right-aligned, tabular | "—" for folders |
| Actions | 44px | Vertical kebab, visible on hover/focus |

- Rows are 52px tall, with a 1px `--line` divider. Hover: a `--surface` pill (10px radius, 4px inset from the edges). Selected: a `--brand-tint` pill.
- Hide Owner below 900px and Size below 760px.

### Grid view
- Folders render as folder cards (smaller: 112px tall).
- Files render as tiles: a 4:3 thumbnail area (`--surface` with a centred 40px glyph when there's no thumbnail) plus a footer with the name and kebab. Radius 14px, flat.
- Selected tile: a 2px `--brand` ring, inset, and a `--brand-tint` footer.

### Buttons
| Variant | Light | Dark |
|---|---|---|
| Primary | `--brand` fill, white text, pill | same |
| Secondary | `--surface` fill, `--ink` text | `--surface` fill, `--ink` text |
| On-brand (in sidebar) | white fill, `--brand` text | white fill, `--brand-deep` text |
| Ghost | no fill, `--brand` text | no fill, `#7FA1FF` text |
| Danger | `--danger` fill, white text | same |

All buttons are pills, 40px default height (36px in tables, 44px in the sidebar), with 600–700 weight labels.

---

## 7. Key Interactions

### Upload: drop zone
Dragging files over the content area gives it a 3px dashed `--brand` inset outline (24px radius), a `--brand-tint` fill at 70%, and one centred line in 18/700 `--brand`: **"Drop to upload to Acme"**. Dropping onto a folder card or row targets that folder, which switches to its solid colour while hovered.

### Upload: the dock (the one orchestrated motion moment)
A floating panel at the bottom-right, 380px wide, 16px radius, `--surface-raised`.
```
╭───────────────────────────────────────────╮
│ ▓▓ Uploading 3 files · 2 min left    ⌄  ✕ │  ← brand-blue header strip
├───────────────────────────────────────────┤
│ ▨ Logo-final.png                       ✓  │
│ ▤ Brief v3.pdf        ▓▓▓▓▓▓▓░░░░  68%    │
│ ▧ Launch-cut.mp4      Paused offline  ↻   │
╰───────────────────────────────────────────╯
```
- The header strip is `--brand` with white text, a small echo of the sidebar.
- Enters with a spring (stiffness 380, damping 32) from 20px below, fading in.
- Progress bars are 4px pills in `--brand`; completed rows show a `--success` tick.
- When offline: "Paused, waiting for connection" with automatic resume. On failure: "Couldn't upload, connection dropped at 40%" + **Retry**.
- On a name clash: an inline choice in the row, **Keep both** / **Replace**.
- It auto-dismisses 6s after everything completes, unless hovered.

### Selection bar
When 1 or more items are selected, a **floating blue pill bar** rises 24px from the bottom centre (the dock moves aside to make room):
```
( ✕  3 selected  │  Share   Move   Download   Trash )
```
It has a `--brand` fill, white text and icons, and white-at-15% hover states. Shift-click selects a range, ⌘/Ctrl-click toggles, dragging on empty space draws a marquee, and `Esc` clears.

### Move, rename, context menu, search
- **Move:** drag onto a folder card, row, breadcrumb, or sidebar "My Drive". The drag ghost is a mini folder card in the first item's colour with a count badge. The **Move to…** dialog shows a folder tree with colour dots, and its button names the target: "Move to Invoices". Invalid targets are disabled with the tooltip "Can't move a folder inside itself".
- **Rename:** `F2` turns the name into an inline input with the base name selected. Duplicate names show inline: "A file named Budget.xlsx already exists here".
- **Context menu** (16px radius, 40px rows, 12px icons in `--ink-muted`):
  ```
  Open                    Enter
  Share…                  ⌘⇧S
  Copy link
  ───────────────────────────
  Download
  Rename                  F2
  Move to…
  Change colour        ▸  (folders)
  Pin to top              (folders)
  Star
  ───────────────────────────
  Details                 I
  Move to trash           Del   ← --danger
  ```
  Items you can't use aren't shown. Viewers don't see Rename, Move, or Trash; editors don't see Share.
- **Search (⌘K):** the pill search opens a command palette (shadcn `Command`, 24px radius), grouped into **Folders** (with colour dots), **Files**, and **Actions**. The matched text is set in weight 700. Type chips sit under the input: `PDF` `Images` `Spreadsheets`.

### Details panel
`I` or the info button slides in a 340px panel on the right with a 24px top-left radius and `--surface` fill. It contains: preview (a large folder card for folders), name, **Who has access** (avatar stack + **Manage access** pill), and details (size, location, created, modified, owner).

---

## 8. Dialogs & Pages

### Share dialog (560px, 24px radius)
```
╭──────────────────────────────────────────────╮
│ Share "Acme"                              ✕  │
│                                              │
│ ( Add people by email          )(Viewer ▾)   │
│                                              │
│ People with access                           │
│ (AN) Alex Njoroge (you)            Owner     │
│ (WK) Wanjiru K.                  (Editor ▾)  │
│      Shared through the folder Clients       │
│ ──────────────────────────────────────────── │
│ Link access                                  │
│ ( Restricted ▾ )   Expires (Never ▾)  🔒 Off │
│                                              │
│ ( ⧉ Copy link )                   ( Done )   │
╰──────────────────────────────────────────────╯
```
- Role menu: Viewer, Editor, then **Remove access** in `--danger`.
- **Copy link** gives a toast: "Link copied". If the link is restricted, the toast adds: "Only people with access can open it".

### Preview
A full-screen overlay on an `#0D1426` scrim at 94% opacity, in both themes. The top bar has back + file name on the left and Download / Share / Details / ✕ pills on the right. ← → keys step through the folder.

| Type | Renders as |
|---|---|
| Image | Fit to screen, scroll to zoom |
| PDF | Native viewer in an iframe |
| Video / audio | Native controls |
| Text / code / md | Panel at 900px max width, 24px radius, rendered markdown for `.md` |
| Other | Large glyph + size + **Download** pill. Copy: "No preview for .zip files" |

### Trash
A Sunflower-tint banner with a 16px radius: "Items in Trash are deleted forever after 30 days." + **Empty trash** (danger ghost). Rows show "Deleted 3 days ago". Its actions are **Restore** and **Delete forever**, which confirms: "Delete 'Brief v3.pdf' forever? You can't undo this." → **Cancel** / **Delete forever**.

### Public share page `/s/[token]`
There's no sidebar. A white header has the logo, "Shared by Alex Njoroge", and a **Download** primary pill. Under it sits a 120px `--brand` band with a 56px scoop on its bottom-right, holding the shared folder's name in white 30/800, so the brand shape appears on every public link. The content below is read-only list/grid.
- Password-protected: a centred 380px card, 24px radius: "This link is password-protected", a pill input, and an **Open** button.
- Expired: "This link has expired. Ask the owner for a new one."

### Sign in
- **Desktop:** split screen. The **left half is the blue panel** with the 56px scoop on its top-right, showing a staggered stack of three folder cards (Blue solid, Coral tint, Mint tint) and the line "Your files, one place." in white 36/800. The **right half** is the form, centred in a 400px column.
- **Primary action:** **Try as guest**, a full-width brand pill, with the line under it: "Opens a demo drive with sample files. Resets daily."
- Then an "or" divider, **Continue with GitHub** (secondary pill), then email + password with **Sign in**.
- **Mobile:** the blue panel shrinks to a 200px top band with its scoop on the bottom-right.

---

## 9. Empty, Loading, Error States

| State | Treatment |
|---|---|
| Empty drive | A large outline folder card (dashed 2px `--brand`, tint fill) holding "Drop files here, or", plus **Upload files** (primary) and **New folder** (secondary) |
| Empty folder | Same, smaller, with the folder's own colour |
| Empty Shared | "Files people share with you show up here." |
| Empty Trash | "Trash is empty." |
| No search results | "No results for 'invioce'." + "Search looks at names only." |
| Loading | Skeleton folder cards and rows in `--surface`, pulsing at 1.2s. Only shown if loading takes over 200ms. |
| Folder not found / no access | "This folder doesn't exist or you don't have access." + **Go to My Drive** |
| Over quota | The dock row reads "Not enough space: needs 120 MB, 46 MB free" + **Open Trash** |
| Action failed | The optimistic change rolls back, with the toast "Couldn't move 3 items. Check your connection and try again." + **Retry** |

---

## 10. Motion

Everything respects `prefers-reduced-motion`, falling back to instant changes.

| Interaction | Motion | Timing |
|---|---|---|
| Upload dock enter | Spring up 20px + fade | stiffness 380, damping 32 |
| Selection bar enter | Spring up 24px + fade | same spring |
| Folder card select | Tint → solid fill, text colour swap | 150ms ease-out |
| Details panel | Slides in from right, content reflows | 220ms `cubic-bezier(.2,.8,.2,1)` |
| Dialog | Scale .96 → 1 + fade | 180ms ease-out |
| Menus / popovers | Fade + 4px slide from anchor | 120ms |
| Item moved / trashed | Row collapses + fades, gap closes via `layout` | 180ms |
| New item | Row background flashes `--brand-tint`, then fades | 900ms |
| Theme switch | Colours crossfade on `html` | 200ms |

Nothing animates on page load. Hover states change colour only, with no lift or scale.

---

## 11. Copy Deck

Voice: plain, direct, sentence case. Buttons say exactly what happens, and the toast repeats the verb.

| Action | Button | Toast |
|---|---|---|
| Create folder | Create | "Folder created" |
| Upload | Upload files | "3 files uploaded" |
| Move | Move to Invoices | "Moved 3 items to Invoices" + **Undo** |
| Rename | (inline, Enter) | "Renamed to Budget-2026.xlsx" |
| Change colour | (swatch) | none, the change is visible |
| Pin | Pin to top | "Pinned Clients" |
| Trash | Move to trash | "Moved to trash" + **Undo** |
| Restore | Restore | "Restored to Clients/Acme" + **Show** |
| Delete forever | Delete forever | "Deleted forever" |
| Share | Share | "Shared with Wanjiru" |
| Copy link | Copy link | "Link copied" |

The **New** menu: New folder, Upload files, Upload folder. Never say: "Oops", "Something went wrong", "Successfully", "Please".

---

## 12. Accessibility

- Text contrast ≥ 4.5:1 in both themes (checked values in §2). Folder solids that fail with white use `--ink` text instead.
- Focus: a 2px `--focus` ring at 2px offset on every control, via `:focus-visible`. In the sidebar, the ring is white.
- The file list is a real `<table role="grid">` with arrow-key navigation (↑↓, Space selects, Enter opens). Grid view uses 2D roving tabindex.
- Folder colour is never the only identifier: every card and row has its name.
- Icon-only buttons have an `aria-label` and a matching tooltip.
- Upload progress announces through an `aria-live="polite"` region at 25% steps and on completion.
- Every drag action has a menu equivalent (**Move to…**).
- Theme: follows the system by default, with Light / Dark / System in the avatar menu (`next-themes`, `class` strategy).

---

## 13. Implementation (Tailwind v4 + shadcn)

`app/globals.css`
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: var(--font-figtree), ui-sans-serif, system-ui, sans-serif;

  --color-page: #FFFFFF;
  --color-surface: #F3F5FB;
  --color-surface-raised: #FFFFFF;
  --color-ink: #121A33;
  --color-ink-muted: #5D6782;
  --color-ink-faint: #97A0B8;
  --color-line: #E4E8F2;
  --color-brand: #2A5BF0;
  --color-brand-deep: #1D46C9;
  --color-brand-tint: #E7EDFF;
  --color-on-brand: #FFFFFF;
  --color-focus: #2A5BF0;
  --color-danger: #E5364B;
  --color-success: #13A672;
  --color-sidebar: var(--color-brand);

  /* folder colours: solid / tint */
  --color-f-blue: #2A5BF0;      --color-f-blue-tint: #E7EDFF;
  --color-f-coral: #FF6B4A;     --color-f-coral-tint: #FFE9E3;
  --color-f-sun: #FFC93C;       --color-f-sun-tint: #FFF5D6;
  --color-f-mint: #22C38E;      --color-f-mint-tint: #DDF7EE;
  --color-f-violet: #7C4DF0;    --color-f-violet-tint: #EEE7FE;
  --color-f-aqua: #1EC8E8;      --color-f-aqua-tint: #DDF7FC;

  --radius-scoop: 56px;
  --radius-dialog: 24px;
  --radius-card: 18px;
  --radius-float: 16px;
  --radius-tile: 14px;
  --radius-row: 10px;
}

.dark {
  --color-page: #0D1426;
  --color-surface: #151D33;
  --color-surface-raised: #1C2540;
  --color-ink: #EEF1FA;
  --color-ink-muted: #9AA4BF;
  --color-ink-faint: #5F6A86;
  --color-line: #253050;
  --color-brand-deep: #1B3CA8;
  --color-brand-tint: #1A2A5C;
  --color-focus: #7FA1FF;
  --color-danger: #FF6B7C;
  --color-success: #3DDC9E;
  --color-sidebar: var(--color-brand-deep);

  --color-f-blue-tint: #1A2A5C;
  --color-f-coral-tint: #4A2219;
  --color-f-sun-tint: #463815;
  --color-f-mint-tint: #123D30;
  --color-f-violet-tint: #2E1F5C;
  --color-f-aqua-tint: #0F3D47;
}
```

Map shadcn's variables onto these: `--background: var(--color-page)`, `--card: var(--color-surface)`, `--popover: var(--color-surface-raised)`, `--primary: var(--color-brand)`, `--primary-foreground: var(--color-on-brand)`, `--muted: var(--color-surface)`, `--muted-foreground: var(--color-ink-muted)`, `--border: var(--color-line)`, `--ring: var(--color-focus)`, `--destructive: var(--color-danger)`, `--radius: 0.75rem`. Then override button and input radii to pills.

**Folder colour in the database:** add `color: text("color").default("blue")` (enum: blue, coral, sun, mint, violet, aqua) and `pinnedAt: timestamp("pinned_at")` to `items` in the Drizzle schema. In the UI, set `--folder-solid` and `--folder-tint` as inline CSS variables on each card from a lookup in `lib/folder-colors.ts`.

### Component map
| BaseDrive component | Built from |
|---|---|
| `AppSidebar` | shadcn `Sidebar` (collapsible = icon) + `rounded-tr-[var(--radius-scoop)] bg-sidebar` |
| `FolderCard` | Custom SVG shape + `ContextMenu` |
| `ColorPicker` | `Popover` + 6 swatch `button`s (`role="radiogroup"`) |
| `StorageBar` | Custom pill bar + `Tooltip` |
| `FileTable` | `Table` + TanStack Table |
| `FileTile` | Custom + `ContextMenu` |
| `ViewToggle` | `ToggleGroup`, pill styled |
| `SelectionBar` | Custom, Framer Motion `AnimatePresence` |
| `UploadDock` | Custom, Framer Motion, Zustand upload store |
| `ShareDialog` | `Dialog` + `Select` + `Switch` + `Popover` |
| `MoveDialog` | `Dialog` + `Collapsible` tree |
| `SearchPalette` | `Command` in `Dialog` |
| `PreviewOverlay` | `Dialog`, full-screen variant |
| `DetailsPanel` | Custom aside; `Sheet` below 1024px |
| Mobile actions | `Drawer` (vaul) |
| Toasts | Sonner, bottom-left so they never cover the dock |

### Build order (fits blueprint weeks 1–2)
1. Tokens, Figtree, theme switch, shell (header, scooped sidebar, content area)
2. `FolderCard` + `ColorPicker` + `StorageBar`
3. List view, grid view, selection bar
4. Context menu, rename, move dialog
5. Drop zone + upload dock
6. Share dialog, preview, details panel
7. Empty/loading/error states, mobile pass (bottom bar scoop)
8. Full pass in dark mode + keyboard-only walkthrough