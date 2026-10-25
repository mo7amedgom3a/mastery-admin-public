# Mastery Academy Design System — Agent Kit

Read this file first. It tells an AI agent (or a developer) how to build any Mastery Academy (ماستري أكاديمي) screen so it looks on-brand in Arabic and English, in light and dark mode.

Mastery Academy is an Arabic-first online training academy (leadership, management, marketing, HR) founded in 2007. The identity is **flat, soft and colourful**: an N-wave logomark with square corners, a coral + ink core with eight bright companions, bold headlines, and a UI with soft rounded corners, borderless buttons and no shadows.

## Files in this kit

| File | What it is | Read it when |
|---|---|---|
| `README.md` | Entry point, golden rules, quick start | Always, first |
| `docs/01-brand.md` | Voice, logo rules, imagery, iconography | Writing copy, placing the logo, choosing images/icons |
| `docs/02-tokens.md` | Every colour, spacing, radius and rule token, light and dark values, contrast pairs | Choosing any colour or size |
| `docs/03-typography.md` | Fonts, stacks, type scale, Arabic rules | Setting any text |
| `docs/04-layout.md` | Grid, container, breakpoints, section rhythm, page structures | Laying out a page or screen |
| `docs/05-components.md` | Every component: markup, variants, states, do/don't. CTAs in detail | Building UI |
| `docs/06-accessibility-rtl.md` | Contrast, focus, RTL/bidi, motion | Before you ship |
| `tokens.css` | CSS custom properties + `.t-*` type classes, both themes | Link in every page |
| `fonts.css` | `@font-face` for the bundled fonts | Link in every page |
| `components.css` | All component classes (`.ma-*`) | Link in every page |
| `tokens.json` | Machine-readable tokens (source of truth) | Tooling, Tailwind/Theme configs |
| `sprite.svg` | Inline SVG sprite: `#ma-logo`, `#ma-mark`, icons | Paste once at the top of `<body>` |
| `assets/logos/*.svg` | Logo files, fixed colours | `<img>` use, social, email |
| `assets/fonts/*.woff2` | IBM Plex Sans Arabic, Raleway | Loaded by `fonts.css` |
| `demo.html` | Live demo of everything, both themes | Visual reference |

## Quick start

```html
<!doctype html>
<html lang="ar" dir="rtl">            <!-- lang="en" dir="ltr" for English -->
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="fonts.css">
  <link rel="stylesheet" href="tokens.css">
  <link rel="stylesheet" href="components.css">
</head>
<body class="ma-page">
  <!-- paste the contents of sprite.svg here -->
  <nav class="ma-nav">…</nav>
  <main class="ma-container">…</main>
  <footer class="ma-footer">…</footer>
</body>
</html>
```

Theme: leave `<html>` without `data-theme` to follow the OS, or set `data-theme="light"` / `data-theme="dark"`. The attribute also works on any container to force a theme locally.

## Golden rules (never break these)

1. **Soft rounded corners, from the scale only.** `--radius-control` (10px) for buttons, inputs and chips; `--radius-card` (16px) for cards, posters, alerts and dialogs; `--radius-tag` (6px) for tags; `--radius-soft` (12px) for photos; `--radius-full` for avatars, bare icon buttons and badges. The logo itself stays sharp.
2. **Flat and borderless buttons.** No button draws a border: neutral actions use the translucent `--fill-soft`, icon tools are bare icons with a circular soft fill on hover. No shadows, no gradients, no tints of brand colours, no blur/glass. Separate content with 1px rules (`--line`, `--line-strong`); only fields and cards keep a 1px border.
3. **Role tokens, not hex.** UI uses `--surface`, `--surface-alt`, `--text`, `--text-muted`, `--line`, `--line-strong`, `--accent`, `--on-accent`, `--focus`. Raw brand colours (`--coral`, `--yellow`…) only for colour fields, tags, posters and card media.
4. **One coral primary CTA per view.** Text on coral is ink (`--on-accent`), never white.
5. **Ink text on every brand colour.** White text only on ink, and on purple at 24px+.
6. **Colour comes in big solid fields**, one colour per field, edge to edge. Not as thin accents on every element.
7. **Arabic first.** Default `dir="rtl"`, Arabic family (`--font-arabic`), taller line-height. Use logical CSS properties (`margin-inline-start`, not `margin-left`).
8. **Logo from the kit only.** Use `#ma-logo` / `#ma-mark` from the sprite or files in `assets/logos/`. Never retype "MasteryAcademy" in a font next to the mark, never redraw, recolour parts, rotate or add effects.
9. **Every interactive element** shows the 2px purple focus ring (`--focus`) and is at least 44px tall on touch.
10. **Status needs words.** Success/warning/danger colours always come with a label or icon.

## Agent checklist before returning code

- [ ] Only `.ma-*` classes and tokens used; no new colours, and radii only from the `--radius-*` scale.
- [ ] No border on any button; icon tools use `.ma-btn--bare`.
- [ ] Each section fits one viewport at 1366×768; card rows are at most 3 wide.
- [ ] Looks right with `data-theme="dark"` (no hard-coded `#fff`/`#000` on surfaces or text).
- [ ] Works with `dir="rtl"` and `dir="ltr"`; directional icons use `.ma-icon-dir`.
- [ ] One primary CTA per view; labels are specific verbs.
- [ ] No horizontal scroll at 360px width.
- [ ] Text contrast ≥ 4.5:1 (see `docs/02-tokens.md` pairs).

## Fonts status

Neue Montreal (English), Swissra (Arabic) and Kaneda Gothic (poster) are licensed and **not bundled yet**. Their stacks fall back to Helvetica Neue/Arial, IBM Plex Sans Arabic (bundled) and Arial Narrow. When the licensed `.woff2` files arrive, add `@font-face` rules to `fonts.css`; nothing else changes.
