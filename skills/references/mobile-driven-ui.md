---
name: mobile-driven-ui
description: Mobile-first responsive UI — layouts that work on every viewport without horizontal overflow, adaptive navigation (drawer/bottom bar vs sidebar), show/hide patterns for small screens, touch targets, safe areas, and fluid typography/spacing. Use when fixing overflow-x scroll, broken mobile layouts, hiding desktop-only chrome on phones, building responsive shells, or the user asks for mobile-first / responsive / all-device UI.
---

# Mobile-Driven UI

Design **mobile first**, then enhance for larger screens. Every layout must stay usable from ~320px up — no horizontal scrolling, no clipped controls, no desktop-only chrome crushing the phone viewport.

## Core principle

If it only looks right at `1440px`, it is unfinished. Start from the smallest width, add complexity with breakpoints, and **adapt or hide** dense UI on small screens instead of shrinking everything until it breaks.

---

## 1. Mobile-first breakpoints

Write base styles for the smallest screen; layer overrides upward:

```txt
default  → phone
sm:      → 640px+
md:      → 768px+
lg:      → 1024px+
xl:      → 1280px+
2xl:     → 1536px+
```

```tsx
// Good: stacked on mobile, row on md+
<div className="flex flex-col gap-4 md:flex-row md:items-center">

// Bad: desktop-first then fighting with max-* overrides everywhere
<div className="flex flex-row max-md:flex-col">
```

Test at least: **320, 375, 390, 768, 1024, 1440** (device toolbar + real device when possible).

---

## 2. No overflow (horizontal scroll is a bug)

Common causes and fixes:

| Cause | Fix |
|---|---|
| Flex/grid child won't shrink | `min-w-0` on the flex/grid child that holds text or nested flex |
| Long words/URLs | `break-words` / `overflow-wrap-anywhere` / `truncate` |
| Fixed widths (`w-[800px]`) | `w-full max-w-*` or responsive `w-full md:w-[…]` |
| Wide tables | Wrap in `overflow-x-auto`; on mobile prefer card/list layout instead of tiny columns |
| Full-bleed vs padding | `w-full`, avoid `100vw` (includes scrollbar → overflow) |
| Negative margins / absolute popovers | Constrain with `max-w-[calc(100%-…)]` or portal + collision detection |
| Pre/code blocks | `overflow-x-auto` on the container |

```tsx
// Classic flex overflow fix
<div className="flex gap-3">
  <div className="min-w-0 flex-1 truncate">{title}</div>
  <button className="shrink-0">Edit</button>
</div>

// Page shell — clip accidental overflow without hiding sticky issues blindly
<main className="min-w-0 overflow-x-hidden">
```

Prefer fixing the culprit (`min-w-0`, fluid widths) over blanket `overflow-x-hidden` on `body` (hides bugs and can clip focus rings/dropdowns).

---

## 3. Show / hide / replace by breakpoint

Don't cram the desktop IA onto a phone. **Swap patterns**:

| Desktop | Mobile |
|---|---|
| Persistent sidebar | Hamburger + drawer / sheet |
| Multi-column toolbar | Fewer actions + "More" menu |
| Hover menus | Tap + disclosure |
| Wide data table | Stacked rows / cards |
| Side-by-side form | Single column |

```tsx
{/* Desktop nav visible lg+; mobile trigger below lg */}
<nav className="hidden lg:flex lg:gap-6">…</nav>
<button className="lg:hidden" aria-label="Open menu" onClick={open}>
  <MenuIcon />
</button>
<MobileDrawer open={open} className="lg:hidden" />

{/* Optional secondary chrome — hide on small screens */}
<aside className="hidden xl:block w-72">…</aside>

{/* Prefer hidden + alternate UI over unreadable scaled-down UI */}
<div className="hidden md:block"><DataTable /></div>
<div className="md:hidden space-y-3"><DataCardList /></div>
```

Rules:
- Use `hidden md:flex` (etc.) for **layout chrome**, not for critical content users must reach (put that behind a clear mobile control).
- When hiding with CSS, keep **accessibility** in mind: hidden decorative chrome is fine; don't leave focusable elements visible to keyboard inside `display: none` — they shouldn't be focusable when hidden (React: don't render, or `hidden` + inert).
- Prefer **not rendering** heavy mobile-only/desktop-only trees when possible (`{isMobile ? …}`) only if you need behavior differences; CSS responsive classes are enough for pure layout.

---

## 4. Interactive patterns that fit the thumb

- **Touch targets** ≥ 44×44px (`min-h-11 min-w-11` or padding that reaches that).
- Spacing between tap targets so mis-taps are rare (`gap-2`+).
- Primary actions in easy reach (bottom bar / lower half) on phones.
- Prefer **sheets/drawers** and full-screen steps over tiny modals on narrow viewports.
- `input` font-size ≥ 16px on mobile to avoid iOS zoom (`text-base`).
- Respect **safe areas**: `pb-[env(safe-area-inset-bottom)]` for fixed bottom navs.
- `hover:` only enhancements — every action must work with **tap** alone.

---

## 5. Fluid layout building blocks

```tsx
// Responsive grid — 1 col → 2 → 3
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// Constrain readable width; pad the viewport
<div className="mx-auto w-full max-w-3xl px-4 sm:px-6">

// Media that never blows the row
<img className="h-auto w-full max-w-full rounded-lg" alt="…" />

// Container queries when the component lives in sidebars AND main
<div className="@container">
  <div className="flex flex-col @md:flex-row gap-3">…</div>
</div>
```

Typography: scale with breakpoints (`text-2xl md:text-4xl`) or fluid `clamp()` via arbitrary values when the design system allows — don't jump from huge desktop headings that wrap into three awkward lines on mobile without a mobile size.

---

## 6. Navigation shells (reference)

```tsx
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center gap-3 border-b px-4 py-3 lg:hidden">
        <MobileNavButton />
        <Logo className="min-w-0 truncate" />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r p-4">
        <DesktopNav />
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-20 lg:p-8 lg:pb-8">
        {children}
      </main>

      {/* Mobile bottom nav — hidden on large screens */}
      <BottomNav className="fixed inset-x-0 bottom-0 lg:hidden pb-[env(safe-area-inset-bottom)]" />
    </div>
  )
}
```

---

## 7. Checklist

- [ ] Mobile-first classes; verified at 320px and a real phone width
- [ ] No horizontal page scroll; flex children use `min-w-0` where needed
- [ ] Long text/URLs truncate or wrap; media is `max-w-full`
- [ ] Desktop-only chrome `hidden` on small screens; mobile alternative provided
- [ ] Tables/toolbars adapt (cards / fewer actions) instead of squashing
- [ ] Touch targets ≥ 44px; no hover-only actions
- [ ] Fixed bottom UI respects safe-area insets
- [ ] Inputs ≥ 16px on mobile; focus states visible
