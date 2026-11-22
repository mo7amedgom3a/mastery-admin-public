# Labs in the admin dashboard (design)

How the back office will author, publish, run and analyse practice labs (المختبرات العملية).

**Status: design only. There are no lab pages, API modules or routes in this app yet.** The backend
module is specified in `newwebsitebackend/app/modules/labs/README.md`; the interim contract and mock
server live in `mastery-front/src/features/labs/api/`. Build the admin screens against that contract
so switching to the real backend is a types regeneration, not a rewrite.

---

## 1. Where it lives

Add a **Practice labs** section under the existing **Learning** module, next to Courses and
Diplomas. It uses the same shell, RTL/i18n and design kit as the rest of the dashboard.

| Route | Screen |
| --- | --- |
| `/learning/labs` | Lab list and health |
| `/learning/labs/new` | Create from template/blank |
| `/learning/labs/:labId` | Overview, release status, quick actions |
| `/learning/labs/:labId/edit` | Full-width Studio workspace |
| `/learning/labs/:labId/attempts` | Attempts and scorecards |
| `/learning/labs/:labId/attempts/:attemptId` | One attempt: dimensions, highlights, event replay |
| `/learning/labs/:labId/analytics` | Funnel, branches, scores, behaviour |
| `/learning/labs/:labId/assignments` | Cohort/company/user assignments |
| `/learning/labs/personas` | Reusable persona library |
| `/learning/labs/templates` | Templates by field |
| `/learning/labs/generate` | Agent-assisted lab builder |
| `/learning/labs/analytics` | Cross-lab overview |

The list shows: title, field, engine (`legacy`/`schema`), status, published version, attempts,
completion rate, average score, owner and last update. Filters: field, status, engine, owner, search.
Row actions: open, preview, duplicate, publish/unpublish, archive.

## 2. Studio workspace

Full-width like the Course Studio (`handle.studio`), with a left panel for navigation and a live
preview on the right. Tabs:

| Tab | What the admin edits |
| --- | --- |
| **Basics** | Title, slug, field/category, engine, difficulty, minutes, locales, product links |
| **Briefing** | Role, scenario, targets, constraints, cover/media |
| **Workflow** | Phases and the Multi-Choice Pathway graph |
| **Personas** | Persona library picker + inline traits, hidden facts, triggers, sample lines |
| **Fields** | Dynamic fields: type, label/help, default, validation, visibility, scoring, analytics |
| **Requirements** | Auth, entitlement, assignment, window, skill, consent; `on_fail` and messages |
| **Scoring** | Dimensions, weights, skills, node/choice points, signals, badges, readiness, XP |
| **Analytics** | Event names, observation rules, behaviour metrics |
| **Recommendations** | Product types/slugs/keywords shown after the debrief |
| **Preview** | Live draft preview, device switch, "run as learner" |
| **Versions** | Published history, diff, restore |
| **Settings** | Release window, rollout %, kill switch, archive |

The editor is draft-only. Publishing snapshots the draft into an immutable version; in-flight
sessions keep their version.

### 2.1 Draft behaviour

- `GET /admin/labs/{id}/draft` returns `{ definition, base_revision }`.
- `PUT /admin/labs/{id}/draft` sends `base_revision`; a stale value returns `409` and the UI shows
  a conflict dialog (reload/diff/overwrite is not silent).
- Autosave is debounced; validation errors are inline and also available via
  `POST /admin/labs/{id}/validate`.
- "Preview" opens `/preview/lab` (storefront) and posts the draft over the existing Studio
  `postMessage` channel; the preview never writes attempts or analytics.

## 3. Multi-Choice Pathway (MCP) builder

"MCP" here means **Multi-Choice Pathways**, not the Model Context Protocol. The API/storage name is
`pathway`.

### Canvas

- Node types: `brief`, `choice`, `dialogue`, `form`, `simulator`, `document`, `crm`, `quiz`,
  `branch`, `end`.
- Edges: `next`, one per choice, and guarded `conditions`; branch labels are editable.
- Pan/zoom, auto-layout, minimap, search, collapse subgraphs.
- Node inspector: title/prompt, persona, fields, choices, effects, conditions, scoring, notes.
- Validation badges on nodes/edges (unknown ref, empty choice list, unreachable, no end).
- JSON view for power users; both views edit the same draft.
- "Run from here" test mode: start a draft session at a node, inspect state/meters, reset.
- Analytics overlay: visits, drop-off, outcome rate, average time, top choice per branch.

### Authoring rules

- Every edge points to a node; the entry exists; at least one reachable `end`.
- Every choice has a label and a target; every form references existing fields; every dialogue
  references an existing persona.
- Cycles must be bounded by `limits.max_steps`.
- Every scoring dimension is used by at least one field/choice (warning, not error).
- Locale completeness is checked before publish.

### Agent-assisted authoring

`/learning/labs/generate`:

1. Prompt + optional source product/README, field, difficulty, minutes, locale.
2. `POST /admin/labs/generate` returns a job; the UI polls `GET /admin/labs/generate/{job_id}`.
3. The result is a draft definition (pathway, personas, fields, requirements, rubric).
4. The UI shows a structured diff and validation errors; "Apply to draft" calls
   `POST /admin/labs/generate/{job_id}/apply`.
5. Generation never publishes. An admin must review and publish.

## 4. Dynamic fields

Fields are data, not React code. The editor supports:

| Type | UI | Validation |
| --- | --- | --- |
| `text` / `textarea` | Input / textarea | max length, pattern |
| `number` / `range` | Number / slider | min, max, step |
| `select` / `radio` | Select / radio group | allowed options |
| `multiselect` / `checkbox` | Checkbox group / toggle | min/max selections |
| `table` | Editable table | column types, row limit |
| `allocation` | Sum-to-100 allocation | total = 100 |
| `document` | Redline/annotate a document | clause options |
| `chat` | Scripted/AI dialogue | node/choice config |

Each field can declare `visible_when` (conditions over fields/facts/meters), a scoring mapping
(`dimension`, `weight`, optional rubric), and an analytics event. The storefront runtime renders the
same schema; bespoke engines may use a `renderer` key.

## 5. Requirements and state

### Lab lifecycle

| State | Public? | New sessions? | Notes |
| --- | --- | --- | --- |
| `draft` | no | no | Editable |
| `in_review` | no | no | SME review/comments |
| `scheduled` | no | after `starts_at` | Release window set |
| `published` | yes | yes (rollout %) | Immutable version |
| `paused` | no | no | In-flight sessions continue |
| `archived` | no | no | Kept for history |

### Session and attempt states

- Session: `created → in_progress → completed | abandoned | expired | failed`.
- Attempt: `scored → flagged → overridden | voided`.
- A session pins `lab_version_id`; publishing does not change it.
- `seq` and `client_action_id` give ordering and idempotency; stale actions are `409`.
- Admin can list in-progress sessions, reset/terminate, extend expiry, flag and override scores;
  every action is audited.

### Release controls

- Locales, start/end window, rollout % (new sessions only), kill switch.
- Publish dialog: validation summary, changelog, "publish now" or schedule.
- Unpublish pauses new sessions; archive removes it from the list but keeps attempts.

## 6. Attempts and live operations

`/learning/labs/:labId/attempts`:

- Columns: learner (or anonymous id), started, duration, score, readiness, status, source, version.
- Filters: status, score band, date, source (`lab`/`demo`/`imported`), flagged.
- Attempt detail: scorecard, dimension bars, timestamped highlights, branch path, event replay,
  admin notes.
- Actions: flag, void/reset, override score (reason required), export.
- Demo/imported attempts are labelled and excluded from business analytics by default.

## 7. Analytics

`/learning/labs/:labId/analytics`:

- Funnel by phase: entries, completions, drop rate.
- Branch heatmap: visits and choice distribution per MCP node; overlay on the canvas.
- Score distribution, readiness bands, dimension averages, time-to-complete.
- Behaviour signals: talk ratio, question counts, policy violations, retries, requirement failures.
- Source/device/locale splits; A/B variant comparison when enabled.
- Cross-lab overview: starts, completions, average score, bottom labs by completion, error rate.

Funnel events come from `b2c.behavior_events`; attempt/action events from `lab_attempt_events`.

## 8. API module in the dashboard

Add `src/lib/api/learning/labs.ts` following the existing pattern:

- operation aliases from `src/types/openapi.ts` after the backend ships;
- `labsPaths`, `labsKeys`, `labsQueries`, service functions;
- admin methods: list/get/create/update/draft/validate/publish/unpublish/archive/duplicate/versions/
  restore/preview/analytics/attempts/flag/reset/override/assignments/release/generate/apply/assets/
  export/import.

Until the backend exists, the same functions can target the frontend mock contract for UI
development (see §10). Do not hand-write response shapes once `openapi.json` includes the module.

## 9. Permissions

Proposed scopes:

- `admin:labs:read` — list/detail/versions/attempts/preview.
- `admin:labs:write` — create/edit/draft/validate/duplicate/import/assets.
- `admin:labs:publish` — publish/unpublish/archive/release.
- `admin:labs:analytics` — analytics and attempt review.
- `admin:labs:assign` — assignments.
- `admin:labs:generate` — agent authoring.

Add them to `src/lib/permissions.ts` (`AREA_SCOPE`/`ACTION_SCOPE`), navigation `scopes`, and the
policy catalog. The API enforces every scope; the UI only hides.

## 10. Mock/demo mode

The storefront mock (`mastery-front/src/features/labs/api/mock/server.ts`) already implements the
contract, including admin routes. For admin UI development before the backend:

- add a small Vite dev adapter that forwards `labsPaths` calls to the mock (or a shared fixture
  package);
- seed 2–3 published labs and one draft, with attempts/events so analytics screens have data;
- label the environment "demo data" and never ship it to production;
- keep the same response shapes so the switch to `openapi` types is mechanical.

## 11. Tests

- Unit: draft optimistic lock, validation errors, publish version, restore, release gates,
  permission guards, attempt override audit.
- Contract: regenerate `openapi.json` + `npm run api:types`; `tsc -b` catches breaking shapes.
- E2E: list → open Studio → edit basics/fields/pathway → validate → preview → publish → open public
  preview; create assignment; filter attempts; override score with reason.
- Visual: RTL/LTR, dark/light, 1366×768 and 360px; MCP canvas keyboard/focus.

## 12. Open questions

1. Is the persona library global or per field/tenant?
2. Should reviewers (`in_review`) be a separate role from publishers?
3. Do B2B admins get a scoped lab list and private definitions?
4. How much of the MCP canvas is canvas-only vs. form/JSON editing for accessibility?
5. Do we expose attempt transcripts to support/ops, and under what consent?
6. Which analytics are real-time vs. nightly aggregates?

---

## 7. Implemented screens (16 Nov 2026)

The back office now ships under **Learning → Practice labs**:

| Route | Screen |
| --- | --- |
| `/learning/labs` | List, KPIs, filters (status, engine) and quick actions |
| `/learning/labs/new` | Create a draft from an engine (starter scenario included) |
| `/learning/labs/:labId` | Overview: health, scenarios, release, validation issues, links |
| `/learning/labs/:labId/edit` | Full-width Studio (tabs in `?tab=`): Basics, Briefing, Requirements, Scoring, Quizzes, Recommendations, Scenarios, Versions, Settings |
| `/learning/labs/:labId/edit?tab=scenarios&scenario=:id` | Scenario document editor: generated form, raw JSON, validate, metadata |
| `/learning/labs/:labId/attempts[/:attemptId]` | Attempt list and detail; flag, void and override with a reason |
| `/learning/labs/:labId/analytics` | Funnel, branch, dimension, signal and score-distribution views |
| `/learning/labs/:labId/assignments` | Cohort/company/user assignments |

Code: `src/lib/api/learning/labs.ts` (services, keys, query options), `src/features/learning/labs/`
(pages, tabs, `schema-form.tsx`). Permissions: `admin:labs:{read,write,publish,analytics,assign}`
(`labs.read`, `labs.write`, `labs.publish`, `labs.analytics`, `labs.assign` in the UI). The Studio is
a full-width route (`handle.studio`); preview opens the storefront from
`VITE_STOREFRONT_ORIGIN`.

Scenario metadata (key/title/weight/status) saves with the document, using the scenario's own
`draft_revision`. Engines whose document schema is open (`additionalProperties`) default to the raw
JSON tab; known fields still render in the form with an extra-properties JSON block.

---

## 8. Composable block builder (16 Nov 2026)

For labs with `engine_key = blocks`, the Studio opens on a **Builder** tab instead of the fixed
Briefing/Pathway form. It is a Notion-style editor over the backend document API:

- Pages are tabs; add/rename/delete pages (the document keeps at least one).
- The canvas lists typed blocks with move up/down, duplicate and delete.
- **Add block** opens the server catalog (`GET /admin/labs/block-types`) grouped by category.
- Selecting a block opens an inspector generated from that block's `props_schema` (same
  `schema-form.tsx` renderer as the rest of the Studio), with a raw JSON tab and an admin-only toggle.
- Fields and personas are edited as JSON in the library card and saved with the whole document.
- **Validate** calls `POST /document/validate`; issues appear above the canvas and inline in the
  inspector. **Preview** opens the storefront with a draft token.
- Saves use the scenario revision; every page/block mutation returns the fresh document, so the
  editor and revision stay in sync. A stale revision returns a conflict instead of overwriting.

New labs: choosing the **Composable pages** engine sends a starter definition (one `judgement`
dimension) and the backend creates `brief → decision → debrief` with a scored choice, so the first
publish works without extra setup.

**Live preview.** The Builder's **Live preview** button frames the storefront `/preview/lab` page and
posts the *unsaved* draft (`{type:"render", blocks, page_id}`) through the shared preview channel.
Switch the section, desktop/mobile, or reload the frame from the card header. Preview runs in studio
mode: it never starts a session, writes attempts or emits analytics.

**Engines & artifacts.** `/learning/labs/engines` lists every registered engine (key, version,
catalog/schema versions, server/client scorer, description) and the full block catalog grouped by
category, including the `chat`, `table`, `form`, `choice`, `dialogue` and `scorecard` artifacts. Each
engine card links to the new-lab form with that engine preselected.

**Planned AI/MCP management.** Full engine/lab/scenario authoring through MCP (so an AI agent can
create complete labs instead of manual Studio work) is planned in
`newwebsitebackend/app/modules/labs/PLAN-AI-MCP.md`. It is not implemented yet.

**Conversion.** Schema labs show **Convert to blocks** in their actions. It creates a separate
blocks-engine copy (default slug `<slug>-blocks`); the source lab is unchanged. Unsupported pathway
node types are listed as errors instead of being dropped.

## 9. AI authoring: review requests, quality check, AI access (17 Nov 2026)

AI clients build lab drafts over MCP (backend `labs/ai`, README §21) and can only **request**
publication. Three screens make the human side of that loop.

| Route | Page | Permission |
| --- | --- | --- |
| `/learning/labs/changes` | Review requests: filter by status (awaiting review by default), requester badge (AI · client), summary | `labs.read` |
| `/learning/labs/changes/:id` | One request (details below) | read; approving or rejecting needs `labs.publish` |
| `/learning/labs/ai` | AI access (details below) | `labs.ai` (`admin:labs:ai`) |

**One request.** The page shows:
- the summary, the requester and model, and the changelog;
- the **quality check stored at request time**;
- a **structural diff** of the current draft against the version it builds on.

It offers these actions:
- preview of the draft, and open in Studio;
- **Approve & publish**, with an optional note;
- **Reject**, with a required note that the AI reads back;
- cancel (the author, or anyone who can publish).

A stale request shows why it cannot be approved.

**AI access.** The page shows:
- the MCP URL with copyable Claude Code and `mcp.json` snippets;
- a warning when `/mcp` is disabled;
- your tokens: name, prefix, scopes, status, last use and client, expiry, and **Revoke**;
- a create dialog with name, scopes (only those you hold: read, write, analytics) and an expiry of
  7/30/60/90 days. The secret is shown once.

**Connected apps (OAuth, 18 Nov 2026).** claude.ai, ChatGPT, VS Code and other connector UIs need
no token.
- The admin pastes the connector URL into the platform. The platform sends the browser to
  `/oauth/consent?request=…`: a route outside the shell, behind `RequireAdmin`, which goes through
  login with `?next=` when needed.
- The consent page shows the app, whether it is a known platform or an app on this computer, the
  host the browser will return to, and scope checkboxes (only scopes you hold, never publish). It
  offers **Allow & connect** and **Deny**.
- Approving creates a *grant*. The AI access page lists grants under **Connected apps**, with
  **Disconnect**.
- The connection card shows the connector URL and the steps for each platform once
  `LABS_MCP_OAUTH_ENABLED` is on.

**Quality check** (`components/quality-report.tsx`) is a button in every lab action bar and in the
engine Studio header. It runs `POST …/check`: validation, style rules and path exploration (best and
worst score per scenario, constant dimensions). An **AI review request** badge links to the open
request for that lab or engine.

**Diff** (`ai-model.ts` → `structuralDiff`):
- Arrays of objects with an `id` (stages, choices, pages, blocks) are matched by id.
- Same-length arrays are compared item by item.
- Values missing on one side and empty or zero on the other are equal, so defaults filled at
  publish time (`any: []`, `min_select: 0`) are not reported.
- The injected `engine` block is ignored.

API layer: `src/lib/api/learning/lab-ai.ts`. The types come from `openapi.json`, where the 10 new
paths were merged in (`npm run api:types`).

Checked on 17 Nov 2026 against the local preview API with a real AI request created through the
toolkit: list → detail (the diff showed only the edited line) → reject with a note → create and
revoke a token → quality check on a lab. There were no console errors.
