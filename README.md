# ChakriChai — BD-first Job Search Aggregator

A prototype full-stack web app for Bangladeshi job seekers. One search fans out to
local BD job boards and BD-friendly remote/global job APIs, normalizes everything
into a common schema, and ranks **Bangladesh-located jobs first**, then remote jobs
open to BD/Asia/Worldwide, then the rest.

## Stack

| Part | Tech | Notes |
| --- | --- | --- |
| `server/` | Node 18+ / Express | **Stateless** — proxies/scrapes live sources per request, no database |
| `client/` | React 18 + Vite | All persistence in browser `localStorage` |

## Data sources

| Source | Kind | Reliability |
| --- | --- | --- |
| Greenhouse boards (GitLab, Vercel, Canonical, Postman, Remote.com, Wise, Invisible) | Official public JSON API | ✅ safe |
| Lever boards (Kraken, Spotify) | Official public JSON API | ✅ safe |
| RemoteOK | Official free JSON API | ✅ safe |
| Arbeitnow | Official free JSON API | ✅ safe |
| **Bdjobs.com** | ⚠️ Unofficial reverse-engineered internal API | best-effort; isolated module, degrades gracefully |
| **BD company career pages** | HTML scraping of top BD tech employers | best-effort; per-company failures are isolated |
| Adzuna | Official API, free keys required | optional — off unless `ADZUNA_APP_ID`/`ADZUNA_APP_KEY` set |

Company board tokens live in `server/src/sources/greenhouse.js` / `lever.js` — edit
the lists to add companies (a dead token contributes zero jobs, never an error).

**BD company career pages** (`server/src/sources/bdcompanies.js`): scrapes the careers
pages of top Bangladeshi tech employers on every search, so jobs posted *only* on a
company's own site still show up. Three parsers: `easyjobs` and `hrythmic` (Bangladeshi
ATS platforms with clean server-rendered markup — one parser covers every company hosted
there) and `generic` (heuristic link scraping, requiring both a job-title-shaped link
text and a posting-shaped URL). Add companies by appending to the `COMPANIES` registry.

The `generic` parser runs two passes: links to a posting (taking the title from a heading
*inside* the link, since anchors usually wrap title + location + "Apply"), then — only if
that finds nothing — job-title-shaped text with no per-job link (Wix-style pages), where
Apply points at the careers page itself. The text pass is deliberately stricter: two or
more words ending in a role noun, and skipped entirely on pages that say they have no
openings. Without those guards, capability headings like "DevOps" or "QA and Test
Automation" scrape as if they were vacancies.

Coverage is uneven and that's expected. On any given day most of these companies simply
aren't hiring, and "no openings" looks identical to a scrape failure unless you check —
so diagnose before assuming a bug. As of Aug 2026: 27 openings across Brain Station 23
(16), Dynamic Solution Innovators (4), Cefalo (3), Kaz Software (2) and Therap (2); the
other 15 genuinely list nothing. The source is additive and never fails a search.

**Bdjobs caveat:** `server/src/sources/bdjobs.js` calls the same internal endpoints
the bdjobs.com web app uses (`api.bdjobs.com/Jobs/api/JobSearch/GetJobSearch` for
search, `gateway.bdjobs.com/.../Job-Details` for full descriptions). These are
unofficial, can change or be blocked at any time, and the module is built to fail
without breaking the rest of the search. Requests to `*.bdjobs.com` are throttled
to ~1/sec and memoized for 5 minutes. Confirm Bdjobs' Terms of Service before using
this beyond a personal prototype.

## Run it

```bash
# 1. install
npm run install:all

# 2. production-ish: build the client, serve everything from Express on :4000
npm run build
npm start            # → http://localhost:4000

# —or— development with hot reload:
npm run dev:server   # API on :4000
npm run dev:client   # Vite on :5173, proxies /api → :4000
```

Optional Adzuna fallback: copy `server/.env.example`, get free keys from
https://developer.adzuna.com/, and export `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`
before starting the server.

## API

- `GET /api/filters` — dropdown option lists: `fieldGroups` (common picks + all 30 Bdjobs professional categories), `roleGroups` (common roles + all 32 Bdjobs designations), `levels` (Entry/Mid/Top, mirroring Bdjobs' Job Level filter). Source of truth: `server/src/bdcategories.js`.
- `POST /api/search` — body `{ fields, fieldOther, roles, roleOther, levels, location, experience, jobType, keywords, salaryMin, salaryMax }` → `{ jobs[], total, truncated, sources[] }`. `sources[]` reports per-source ok/count/error so the UI can show degraded sources without failing the search. Selected Bdjobs categories/designations become precise `category=` queries on the Bdjobs API (with `jobLevel=` from `levels`), and the Bdjobs module progressively broadens the query if a narrow combination returns nothing.
- `GET /api/description?source=bdjobs&id=<jobId>` — lazy full-description fetch for sources whose search payload only carries a snippet. Source-whitelisted + id-validated (no arbitrary URL fetching).
- `GET /api/health`

Every job is normalized to the common schema (`server/src/normalize.js`): `id`,
`title`, `company`, `location`, `posted_date`, `snippet`,
`full_description_html`, `apply_url` (always the original posting — the Apply
button never opens an internal form), `source`, plus `job_type`, `salary`,
`tags`, `remote`, and ranking annotations `location_tier` / `location_tier_label`.

## Ranking (server/src/rank.js)

1. Location tier: Bangladesh (+100) → remote open to Worldwide/Asia (+60) → other remote (+40) → region-locked remote (+15) → on-site abroad (0)
2. Relevance: selected fields/roles/keywords matched against title (+30 each) or body (+12); jobs matching **no** selected term group are dropped
3. Soft signals: experience-level hints, job-type match, salary-range overlap, freshness (≤30 days)

## localStorage layout (client/src/lib/storage.js)

| Key | Purpose |
| --- | --- |
| `jobsearch:cache:<filterHash>` | `{ results, fetchedAt }`, TTL 3 h, ~12 entries max, quota-safe |
| `jobsearch:lastFilters` | auto-fills the form and restores the last search on return visits |
| `jobsearch:bookmarks` | starred jobs shown in the **Saved** tab |

Trade-off: localStorage is per-browser/per-device (~5 MB, no sync). Fine for a
personal prototype; multi-device sync would need a real backend DB later.

## Politeness / resilience

- Per-host minimum request intervals + 5-minute response memo (`server/src/util/http.js`)
- Hard timeout per source (15 s) — one slow/dead source degrades, never blocks
- Individual Greenhouse/Lever boards fail independently
- Sanitized description HTML (scripts/forms/event handlers stripped) before rendering
