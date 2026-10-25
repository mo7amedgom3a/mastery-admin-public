---
name: component-driven-development
description: Component-Driven Development (CDD) with React — build UI bottom-up from isolated components, compose pages from primitives, Storybook/stories as the source of truth, and contract-first props. Use when scaffolding components, introducing Storybook, refactoring pages into reusable pieces, or the user asks for component-driven / atomic / design-system-first React work.
---

# Component-Driven Development (React)

Build UI **bottom-up**: small, isolated components first → compose features/pages from them. The component (with its props contract and states) is the unit of design, review, and test — not the whole page.

## Core principle

A page is an assembly of components. If a component only works inside one page with app-wide context wired in, it is not component-driven yet — extract until it renders usefully in isolation (Storybook, Vitest/RTL, or a playground route).

```
Primitives (Button, Input, Icon)
    → Patterns (FormField, Modal, DataTable)
        → Features (TaskList, CheckoutSummary)
            → Pages / routes (compose features + data)
```

---

## Workflow (every new UI)

1. **Define the contract** — props, variants, and states (default, loading, empty, error, disabled) before styling the full page.
2. **Build the leaf component in isolation** — no router, no global store, no real API. Pass data via props; callbacks via `onX` props.
3. **Cover states as stories / examples** — at least: default, edge content (long text), empty, loading, error, interactive.
4. **Compose upward** — wrap with a container/hook that fetches data; keep the presentational component pure.
5. **Only then mount on a route** — page files stay thin: layout + feature containers.

Do **not** start with a 400-line page component and "extract later." Extraction under deadline rarely happens.

---

## Component contracts

```tsx
// Explicit, minimal props — variants via union, not boolean soup
type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  disabled?: boolean
  onClick?: () => void
}

// Avoid: isPrimary, isSecondary, isLarge, isSmall, showIcon, hideIcon…
```

Rules:
- **Props in, events out** — no reading global auth/theme inside a primitive; accept `disabled` / `className` / slots instead (or a thin theme-aware wrapper).
- **Composition over config** — prefer `<Card><CardHeader/>…` children/slots over twenty optional render props.
- **One responsibility** — if the name needs "and", split (`TaskItem` vs `TaskList`).
- **Stable public API** — rename/break props deliberately; treat shared components like a mini package.

---

## Presentational vs container

| Presentational | Container / feature |
|---|---|
| Renders from props | Loads data (React Query, loaders) |
| No fetch, no router | Wires hooks, URL params, mutations |
| Easy stories & unit tests | Integration / page tests |
| Reusable across features | Feature-specific |

```tsx
// Presentational — CDD unit
export function TaskList({ tasks, onToggle }: TaskListProps) {
  return (
    <ul role="list">
      {tasks.map((t) => (
        <TaskItem key={t.id} task={t} onToggle={onToggle} />
      ))}
    </ul>
  )
}

// Container — composition root for the feature
export function TaskListContainer() {
  const { data, isLoading, error, refetch } = useTasks()
  if (isLoading) return <TaskListSkeleton />
  if (error) return <ErrorState retry={refetch} />
  if (!data?.length) return <EmptyState />
  return <TaskList tasks={data} onToggle={toggleTask} />
}
```

---

## Storybook (or equivalent) as source of truth

- Every shared/presentational component gets stories for key states.
- Review UI in Storybook before wiring routes — catches a11y, spacing, and edge content early.
- Use stories as visual regression / interaction test targets when the project has that pipeline.
- Colocate: `Button.tsx`, `Button.stories.tsx`, `Button.test.tsx`.

If the project has no Storybook, still keep a **states matrix** in the PR description or a `__examples__` route — same discipline, lighter tooling.

---

## Design system & tokens

- Primitives consume **design tokens** (spacing, color, type) — not one-off hex/px.
- Features compose primitives; they don't reinvent `Button`.
- Changing a primitive updates every consumer — that's the point; keep primitives boring and stable.

Cross-check visual/a11y polish → [frontend-ui.md](frontend-ui.md).

---

## Testing in CDD

- **Unit:** presentational components with RTL — props → roles/text; fire events; assert callbacks.
- **Interaction:** critical flows in stories or integration tests.
- **Avoid:** mounting the whole app to assert a button label.

Align with the TDD skill when driving a component from a failing test: write the interaction test/story assertion first, then implement.

---

## Checklist

- [ ] Built bottom-up (primitive → pattern → feature → page)
- [ ] Presentational piece renders in isolation with props only
- [ ] Loading / empty / error / disabled states defined
- [ ] Stories or equivalent examples for shared components
- [ ] Page/route file only composes containers — no fat page components
- [ ] No unnecessary global store inside primitives
