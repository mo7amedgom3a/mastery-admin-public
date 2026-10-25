---
name: frontend
description: Frontend engineering with React — component-driven development, UI architecture, accessible production UI, Tailwind CSS, mobile-first responsive layouts (no overflow, adaptive show/hide), rendering optimization, SEO, GEO, and client security. Use when building React/Next.js components or pages, writing Tailwind classNames, fixing mobile overflow or responsive shells, optimizing re-renders, improving search/AI citations, or reviewing frontend code. Trigger for Storybook/CDD, Tailwind, mobile-first/responsive, useMemo/lazy, SEO/GEO, or "how should I structure this component."
---

# Frontend Engineering (React)

Build React UIs that are **component-driven, accessible, responsive on every device, fast, and secure** — composition first, mobile first, measure before memoizing, trust the server for auth.

## Core principles

1. **Component-Driven Development** — build bottom-up (primitive → pattern → feature → page); pages only compose.
2. **Composition over configuration** — slots/children beat boolean prop soup.
3. **Separate presentation from data** — presentational components take props; containers/hooks fetch and mutate.
4. **Mobile-driven UI** — no horizontal overflow; adapt or hide dense chrome on small screens.
5. **Render less, load less** — colocate state, split code by route, memoize only when it earns its keep (or let React Compiler do it).
6. **Browser is hostile** — no tokens in `localStorage`; real authz on the server.

---

## 1. Component-Driven Development (essentials)

```
Button / Input     →  FormField / Modal     →  TaskList     →  /tasks page
(primitive)           (pattern)                (feature)       (route)
```

- Define **props + states** (default, loading, empty, error) before wiring the route.
- Develop presentational pieces **in isolation** (Storybook/stories or examples).
- Colocate `Component.tsx`, `Component.stories.tsx`, `Component.test.tsx`, hooks, types.
- Prefer composable APIs (`<Card><CardHeader/>…`) over mega-props.

Full workflow → [references/component-driven-development.md](references/component-driven-development.md).

---

## 2. UI quality (essentials)

- Follow the **project design system** — spacing scale, type hierarchy, semantic color tokens.
- Avoid generic AI aesthetics (purple gradients, oversized rounded cards, shadow stacks).
- Every interactive UI: keyboard access, focus management, meaningful empty/loading/error states.
- Mobile-first responsive layouts; test 320 / 768 / 1024 / 1440.

Polish, a11y, state patterns → [references/frontend-ui.md](references/frontend-ui.md).

---

## 3. Tailwind CSS (essentials)

- Utility-first layout with design tokens in `theme.extend`; keep `content` paths correct so classes aren't purged.
- Prefer composable utilities over huge `@apply` blobs except for repeated primitives.
- Responsive variants (`md:`, `lg:`) and `dark:` from a consistent strategy; IntelliSense + class sorting in the toolchain.

Deep dive → [references/tailwind-css-specialist.md](references/tailwind-css-specialist.md).

---

## 4. Mobile-driven UI (essentials)

- **Mobile first** — base styles for phone, enhance upward.
- **No overflow** — `min-w-0` on flex children, `max-w-full` on media, avoid fixed `w-[800px]` / `100vw`.
- **Adapt chrome** — sidebar → drawer; table → cards; `hidden lg:flex` + mobile alternative, not unreadably scaled desktop UI.
- Touch targets ≥ 44px; safe-area padding for fixed bottom navs; no hover-only actions.

Deep dive → [references/mobile-driven-ui.md](references/mobile-driven-ui.md).

---

## 5. State: pick the lowest tier that works

```
useState          → local UI
lifted state      → 2–3 siblings
URL searchParams  → shareable filters/pagination
React Query / SWR → server/cache data
Context           → theme/locale (read-heavy)
Zustand           → complex client UI state (never auth tokens)
```

Don't prop-drill past ~3 levels — restructure or use context/store. Don't put server data only in Zustand when a query library fits better.

---

## 6. Rendering & load performance (essentials)

**Structure first**
- Colocate state so typing/hover doesn't re-render the whole page.
- Selective store/context subscriptions; stable list keys.

**Memoization (deliberate)**
- `memo` — pure child, parent re-renders often, props actually stable.
- `useMemo` — expensive derived data.
- `useCallback` — needed for memoized children or stable hook deps.
- If **React Compiler** is on, skip manual memo by default — follow repo guidance.

**Lazy loading**
- `React.lazy` + `Suspense` (or Next `dynamic`) for **routes** and heavy widgets (charts, editors, modals).
- Meaningful skeletons as fallbacks; don't lazy-load tiny components.

**Also:** virtualize long lists; `useTransition` / `useDeferredValue` for non-urgent heavy updates.

Deep dive → [references/react-performance.md](references/react-performance.md).

---

## 7. SEO & GEO (essentials)

**SEO** — SSR/SSG for indexable routes; unique title/description/canonical/H1; sitemap + robots; JSON-LD; OG tags; Core Web Vitals.

**GEO** (Generative Engine Optimization) — write extractable answers (question headings + direct answer first); FAQ/HowTo clarity; author/dates/citations; consistent entity identity so AI answer engines can cite you.

Deep dives → [references/seo.md](references/seo.md) · [references/geo.md](references/geo.md).

---

## 8. Security (essentials)

- Session tokens in **HttpOnly + Secure + SameSite** cookies — not `localStorage` / persisted Zustand.
- No unsanitized `dangerouslySetInnerHTML`; CSP as backstop.
- Client route guards are UX only — **authorize on the server**.
- CSRF protection when using cookie sessions.

Full guidance → [references/frontend-security.md](references/frontend-security.md).

---

## Checklist

- [ ] Built CDD-style: isolated presentational component + container + thin page
- [ ] Loading / empty / error states handled; keyboard-accessible
- [ ] Design-system tokens / Tailwind utilities used; no one-off AI aesthetic
- [ ] No horizontal overflow at 320px; desktop chrome hidden or replaced on small screens
- [ ] State at the lowest sensible tier; no token persistence in JS storage
- [ ] Hot paths: no pointless re-renders; routes/heavy UI code-split when needed
- [ ] Indexable pages have metadata/canonical; answer-worthy content is extractable for SEO/GEO
- [ ] Profiler/measure before adding widespread memo

---

## Additional resources

- [Component-driven development](references/component-driven-development.md)
- [Frontend UI engineering](references/frontend-ui.md)
- [Tailwind CSS specialist](references/tailwind-css-specialist.md)
- [Mobile-driven UI](references/mobile-driven-ui.md)
- [React performance](references/react-performance.md)
- [SEO](references/seo.md)
- [GEO (generative engine optimization)](references/geo.md)
- [Frontend security](references/frontend-security.md)
