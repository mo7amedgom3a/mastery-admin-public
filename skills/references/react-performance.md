---
name: react-performance
description: Optimize React rendering and load performance — when to use memo/useMemo/useCallback, React Compiler guidance, state colocation, list virtualization, lazy loading/code splitting, transitions and deferred values, and avoiding common re-render traps. Use when the UI feels janky, profilers show wasted renders, bundles are large, or the user asks about memoization, lazy loading, or React performance.
---

# React Rendering & Load Performance

Make React apps fast by **rendering less often, rendering less work, and loading less code up front** — not by sprinkling `memo` everywhere.

## Core principle: measure, then fix the cause

1. Prefer **correct state placement** and **stable component boundaries** over memoization.
2. Use React DevTools Profiler / why-did-you-render only when there's a real jank or CPU problem.
3. If the project uses **React Compiler**, do **not** add `useMemo` / `useCallback` / `memo` by default — follow the repo's compiler guidance; manual memo is for escape hatches and non-compiled code.

---

## 1. Stop unnecessary re-renders (state & structure)

Most "performance bugs" are state living too high or props changing identity every render.

- **Colocate state** — keep state in the nearest component that reads it. A keystroke in a filter shouldn't re-render the whole page tree.
- **Lift only what must be shared** — don't put ephemeral UI state in a global store.
- **Split components** so frequent updates (input text, cursor, hover) live in a small child; static siblings don't re-render.
- **Selective subscriptions** — Zustand/Redux/React Query: subscribe to selectors (`useStore(s => s.count)`), not the whole store. Avoid `useStore()` that returns new objects without equality checks.
- **Children as props / composition** — pass `children` so a parent re-render doesn't recreate heavy subtrees unnecessarily when the child element is stable.
- **Keys** — stable ids for lists; never use array index if items reorder/insert. Remounting via bad keys is a silent performance killer.

```tsx
// Good: only the input re-renders on each keystroke
function SearchPage({ results }: { results: Result[] }) {
  return (
    <>
      <SearchInput /> {/* owns query state locally, or debounces before lifting */}
      <ResultsList results={results} />
    </>
  )
}
```

---

## 2. Memoization — use deliberately

| Tool | Purpose | Use when |
|---|---|---|
| `React.memo` | Skip re-render if props shallow-equal | Pure presentational child gets same props but parent re-renders often |
| `useMemo` | Cache expensive **calculation** result | Derived data is costly (big filter/sort/map) and inputs change rarely |
| `useCallback` | Stable function identity | Passing callbacks to memoized children **or** deps of other hooks that need referential stability |

**Don't:**
- Memoize everything "just in case" — costs memory and comparison time; hurts readability.
- Wrap cheap calculations in `useMemo`.
- Use `useCallback` without a memoized child or a hook dependency that needs stability.
- Depend on objects/arrays created inline in the parent — `memo` won't help if `items={[...]}` or `style={{}}` is new every time.

```tsx
// Stabilize props for a memoized list row
const handleSelect = useCallback((id: string) => {
  setSelectedId(id)
}, [])

const visible = useMemo(
  () => items.filter((i) => i.name.includes(query)),
  [items, query],
)

return <VirtualList items={visible} onSelect={handleSelect} />
```

**Context caveat:** any context value change re-renders all consumers. Memoize context value (`useMemo(() => ({ user, logout }), [user])`) or split contexts (state vs dispatch).

---

## 3. Concurrent-friendly updates (React 18+)

- **`useTransition`** — mark non-urgent updates (filtering a large list, tab content) so typing/clicks stay responsive.
- **`useDeferredValue`** — defer expensive renders that depend on rapidly changing input.
- **`useEffectEvent`** (when available in the project's React version) — read latest props/state in effects without re-subscribing; prefer over stuffing unstable deps into effect arrays.

```tsx
const [query, setQuery] = useState('')
const deferredQuery = useDeferredValue(query)
const results = useMemo(
  () => filterHugeList(items, deferredQuery),
  [items, deferredQuery],
)
```

---

## 4. Lists & heavy UI

- **Virtualize** long lists (`@tanstack/react-virtual`, `react-window`) — don't mount 10k DOM nodes.
- Avoid inline anonymous components in hot lists (`items.map(i => { const Row = () => …})`).
- Prefer CSS for animations; avoid driving layout from React state at 60fps.
- Images: size attributes, modern formats, lazy `loading="lazy"` below the fold; avoid huge unoptimized assets in the critical path.

---

## 5. Lazy loading & code splitting

Cut initial JS; load routes and heavy widgets on demand.

```tsx
import { lazy, Suspense } from 'react'

const SettingsPage = lazy(() => import('./SettingsPage'))
const Chart = lazy(() => import('./HeavyChart'))

// Route-level (React Router / Next.js dynamic)
<Suspense fallback={<PageSkeleton />}>
  <SettingsPage />
</Suspense>

// Widget-level — defer until visible or opened
{showChart && (
  <Suspense fallback={<ChartSkeleton />}>
    <Chart data={data} />
  </Suspense>
)}
```

Rules:
- **Split by route** first (biggest win), then by heavy modals/editors/charts.
- Always pair `lazy` with **`Suspense`** and a meaningful fallback (skeleton > spinner).
- Next.js: `next/dynamic` with `ssr: false` only when the module truly needs browser APIs.
- Prefetch on intent (link hover, idle) when navigation is predictable — don't prefetch everything.
- Avoid lazy-loading tiny components — the round trip costs more than the bytes saved.

---

## 6. Data-fetching performance

- Cache server state (React Query / SWR) — dedupe, stale-while-revalidate, don't refetch on every mount blindly.
- Parallelize independent requests; don't waterfalls in client-only trees when the framework allows server fetch.
- Paginate / infinite-scroll large collections; don't load the entire dataset into React state.
- Debounce search inputs before updating query keys.

---

## 7. Checklist

- [ ] State colocated; frequent updates don't re-render large static trees
- [ ] Store/context subscriptions are selective; context values are stable
- [ ] `memo` / `useMemo` / `useCallback` only where measured or clearly needed (or compiler handles it)
- [ ] Long lists virtualized; images/lazy below the fold
- [ ] Routes and heavy widgets code-split with Suspense fallbacks
- [ ] No new object/array/function props defeating memo in hot paths
- [ ] Profiler confirms the fix (before/after) for non-trivial changes
