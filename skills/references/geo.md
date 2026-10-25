---
name: geo
description: Generative Engine Optimization (GEO) — structure content and pages so AI answer engines (Google AI Overviews, ChatGPT, Perplexity, Bing Copilot, Gemini) can cite and summarize them accurately. Use when optimizing for AI search, citations in LLM answers, entity clarity, FAQ/answer blocks, or the user asks about GEO, AEO, or "showing up in ChatGPT/Perplexity."
---

# GEO (Generative Engine Optimization)

Optimize so **generative/answer engines** can find, trust, and cite your content when synthesizing answers — complementary to classic SEO, not a replacement.

## Core principle

Answer engines reward **clear, self-contained, attributable facts** with strong entity identity — pages that state who you are, what is true, and where claims come from. Vague marketing copy rarely gets cited; precise, quotable explanations do.

GEO ≠ stuffing "for AI" keywords. It is **clarity, structure, evidence, and extractability**.

---

## 1. How this differs from SEO

| SEO focus | GEO focus |
|---|---|
| Rank blue links in SERPs | Be selected as a **source/citation** inside AI answers |
| Keywords + backlinks + CWV | Atomic facts, definitions, step lists, citations, entity consistency |
| Click to your site | Often zero-click — still win brand/mention/citation; link when the engine shows sources |
| Title/meta for CTR | Passage-level answerability (the paragraph that answers the question) |

Do both: technical SEO keeps you crawlable; GEO makes passages **usable as answers**.

---

## 2. Write for extractable answers

- Lead sections with a **direct answer** (2–4 sentences) before background fluff — "what / who / when / how much" up front.
- Use **question-shaped H2/H3** that match real queries (`## How does X pricing work?`) and answer immediately under them.
- Prefer **definitions, comparisons, steps, tables, and bullet facts** over long narrative-only prose.
- Keep one idea per paragraph; avoid burying the claim mid-wall-of-text.
- Include **concrete numbers, dates, version names, and constraints** models can quote accurately.
- Add a concise **FAQ** block for high-intent questions (also valid `FAQPage` JSON-LD when visible on the page).

```markdown
## What is connection pooling?

Connection pooling reuses a fixed set of database connections across requests
instead of opening a new connection per request. Typical pool size is tuned so
`(instances × pool size) ≤ database max_connections`.

### Why it matters
- …
```

---

## 3. E-E-A-T and citability

Answer engines prefer sources that look **experienced, expert, authoritative, trustworthy**:

- Clear **author** with credentials/bio on articles; **Organization** identity on the site.
- **Dates**: `datePublished` / `dateModified` visible and in structured data — freshness matters for changing topics.
- **Cite primary sources** (docs, papers, laws, official stats) with links; don't invent statistics.
- About / contact / editorial policy pages that explain who publishes the content.
- Consistent **sameAs** / entity footprint (official site, Wikidata, LinkedIn, GitHub, Crunchbase as appropriate) so models resolve "who is this brand."

---

## 4. Technical signals that help GEO

GEO still depends on crawlable HTML — reuse SEO foundations:

- SSR/SSG so answer bots see the same text users see.
- Accurate **JSON-LD** (`Article`, `FAQPage`, `HowTo`, `Organization`, `Product`) matching visible content.
- Stable canonical URLs; avoid cloaking or showing different main content to bots vs users.
- Fast pages (CWV) — slow/blocked content is less likely to be fetched and reused.
- Public access to citation-worthy pages (don't put the only good answer behind hard login walls if you want AI citation).
- `llms.txt` (emerging convention) — optional root file pointing models at preferred markdown/docs URLs; keep it accurate if you publish one; don't treat it as a ranking magic switch.

Allow reputable AI crawlers in `robots.txt` when citation traffic/brand is a goal (policy choice — some sites disallow; be deliberate).

---

## 5. Entity & brand consistency

- One canonical **product/company name** spelling everywhere (title, H1, schema, nav).
- Disambiguate early: "X is a ___ for ___" so models don't confuse you with a same-named entity.
- Maintain a single **source-of-truth page** per important entity (product, pricing, docs overview) and internal-link to it.
- Keep claims consistent across homepage, docs, and blog — contradictions reduce trust.

---

## 6. Formats engines reuse often

Prioritize pages that naturally answer:

- **Explainers** — "What is…", "How … works"
- **Comparisons** — "A vs B" with a fair table
- **How-tos** — numbered steps with prerequisites and outcomes
- **Pricing / limits** — explicit numbers and caveats
- **Changelogs / version notes** — dated facts
- **Original data** — benchmarks, surveys, research you uniquely own

Thin affiliate boilerplate and pure keyword galleries rarely earn citations.

---

## 7. Measurement (practical)

- Track brand/query mentions and citation links from AI products where visible (Perplexity citations, Bing/Google where shown).
- Watch Search Console for queries that become AI Overviews — ensure your page still answers better/deeper than the overview.
- Log landing traffic from AI referrers when present; don't obsess over vanity "AI rank" tools with opaque methods.
- Refresh high-value answer pages when facts change — stale cited pages hurt trust.

---

## Checklist

- [ ] Key pages open with a clear, quotable answer under question-like headings
- [ ] FAQ / HowTo / Article schema matches visible content; author and dates present
- [ ] Organization/entity identity consistent (name, about, sameAs)
- [ ] Claims backed by citations; no invented stats
- [ ] SSR/SSG + SEO basics in place so engines can fetch real HTML
- [ ] Important facts not trapped only in images/PDFs/JS-only UI without HTML text
- [ ] Freshness maintained on pages likely to be cited
