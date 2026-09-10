# NeuroBridge Privacy, Data Security & Data-Minimization Audit

Date: 2026-09-10
Scope: frontend (`src/`), backend (`backend/`), Supabase schema/RLS (`supabase/migrations/`).

This audit inspected the actual running implementation — code, schemas, RLS policies, and tests — not just documentation. Every issue listed under "Fixed in this pass" was verified in code before and after the change, and covered by an automated test where practical. All 173 existing backend tests plus new tests pass after these changes (see "Testing performed").

---

## 1. Data collected

| Category | Examples | Where |
|---|---|---|
| Identity | name, email, Supabase user id | Supabase `auth.users` (managed by Supabase), mirrored into `nb_auth`/`nb_prefs_*` localStorage |
| Government health ID | ABHA Health Account ID (self-entered, optional) | `user_metadata.abhaId` (real accounts) / localStorage only (see §8 residual risk) |
| Neurodivergence-related self-report | selected "disorders"/support modules (OCD, ASD, ADHD, anxiety, dyslexia, dyscalculia, dyspraxia), questionnaire-derived tags | `user_metadata.disorders`/`tagProfile`, localStorage |
| OCD clinical free text | journal `trigger`/`obsession`/`compulsion`/`emotion`/`notes`, ERP session `notes`, AI-generated `ai_analysis`/`ai_summary` | Postgres (`ocd_journal_entries`, `erp_sessions`) via FastAPI |
| ADHD data | task breakdown text, focus session `intent`, durations | Postgres (`adhd_task_breakdowns`, `adhd_focus_sessions`) |
| Anxiety data | grounding session type + pre/post anxiety scores (no free text) | Postgres (`anxiety_grounding_sessions`) |
| ASD data | AI-generated social scenario text, daily routine steps | Postgres (`asd_social_scenarios`, `asd_routine_steps`) |
| Agent chat | every message the user sends the AI assistant, every tool call + its arguments, execution telemetry | Postgres (`agent_messages`, `agent_action_logs`, `agent_executions`) |
| Dyslexia reading data | uploaded documents (OCR'd text), reading sessions, phoneme errors, cognitive profile | Supabase `reading_files`, `reading_sessions`, `phoneme_errors`, `cognitive_profiles` (written directly by the frontend under RLS) |
| Usage/behavioral | which modules were used, personalization "learnings", adaptive-engine outcome history, streaks | Postgres `agent_learnings`/`intervention_outcomes`; various localStorage keys (`nb_ocd_*`, `nb_memory_*`, etc.) |
| Voice | none persisted — see §4 | n/a (transient only) |

Nothing in this list is collected that isn't used by a visible feature. The one true dead-code exception (`useVoiceRecording.js`, capable of retaining raw audio in memory but never wired into any screen) was removed in this pass rather than left as unused surface area.

## 2. Where it is stored

- **Supabase Postgres**, accessed two different ways:
  - **Via FastAPI/SQLAlchemy** (OCD/ADHD/anxiety/ASD/agent tables): the backend's own `owner_id`/`user_id` filters are the *only* access-control layer here — RLS is enabled on these tables but with **no policies** (intentional default-deny for PostgREST/anon-key access; the FastAPI connection uses the owning role, which is RLS-exempt by Postgres default). This is documented in `supabase/migrations/20260905000000_agent_backend_tables.sql` and is the correct design *provided* `DATABASE_URL` always points at that owning connection, never at a lower-privileged one that would silently return nothing.
  - **Directly from the frontend via `supabase-js`** (dyslexia tables, `reading_files`): protected by real per-user RLS policies (`auth.uid() = user_id`), verified in the migrations.
- **Browser `localStorage`**: profile cache, all OCD self-report data (`nb_ocd_*`), guardian notes, ASD ward settings, adaptive-engine behavioral memory, reading-history fallback cache. See §7 for the security implications.
- **Supabase Storage** (`reader-files` bucket): user-uploaded documents for the Dyslexia Reader.

## 3. What leaves the device

- Every backend API call (`/api/ocd/*`, `/api/adhd/*`, `/api/anxiety/*`, `/api/agent/*`, `/api/ai/*`, `/api/privacy/*`) — over HTTPS in any real deployment (TLS itself is terminated by the hosting platform, not by the FastAPI app; the app does not enforce or verify it, which is normal for an app meant to sit behind a managed load balancer/CDN, but is not independently verified in code).
- Supabase auth/session calls and direct Supabase table/storage reads for dyslexia data (again over Supabase's own HTTPS endpoint).
- Gemini API calls — now **exclusively server-to-server** from the backend (see §4). No frontend code calls `generativelanguage.googleapis.com` directly anymore.
- Nothing is sent to any analytics/error-reporting/telemetry vendor — none is integrated (verified: no Sentry/PostHog/Mixpanel/Amplitude/GA imports anywhere in `src/`).

## 4. What is sent to Gemini

Two call paths, both server-side only as of this audit:

1. **Agent chat** (`backend/services/agent_service.py`): the current user message, a short rolling history of the same conversation, a system prompt, and an intent-scoped "context bundle" (only the relevant module's own summary — never another user's data, never raw DB rows beyond what a real tool call returned). No email, name, or ABHA ID is included in any prompt.
2. **OCD AI-assist** (`backend/services/ai_service.py`): exposure category (low sensitivity), and — genuinely sensitive — the raw text of ERP session notes and journal `trigger`/`obsession`/`emotion` fields, sent verbatim for AI-generated summaries/analysis. No user identifier is attached to these prompts.
3. **General AI proxy** (`backend/routers/ai_proxy_router.py`, added in this pass): dyslexia text-simplification prompts, OCR'd document text/images (Gemini Vision), ASD social-scenario/emotion-decoder generation prompts, and conversation sentiment-analysis text. These **used to be sent directly from the browser** using a client-bundled API key (`VITE_GEMINI_API_KEY`) — extractable by anyone who opened devtools, with no auth, no rate limiting, and no server-side visibility. They now go through this authenticated, rate-limited backend proxy instead; the API key never leaves the server.

**What is never sent to Gemini:** raw audio, full profile objects, ABHA ID, or another user's data. The social-communication feature (`aiService.js`) explicitly documents and enforces "no name, userId, audio, or full transcript" in its prompts.

**Residual risk:** the OCD journal/ERP content sent to Gemini is inherently sensitive (it's the entire point of the feature — AI-assisted ERP analysis). This is a real, unavoidable trade-off of the feature as designed; the mitigation applied is *not sending any identifying data alongside it*, not avoiding the content itself. If stricter data handling is required, the only real fix is making AI analysis of journal/ERP content an opt-in the user can decline per entry.

## 5. Retention behavior

- No automatic time-based retention/expiry exists anywhere (no TTL columns, no cron/cleanup job). All rows persist indefinitely until explicitly deleted.
- `AgentActionLog.tool_args` duplicates free-text content (e.g. task descriptions, ERP notes) a second time beyond the domain table itself, for observability — also with no expiry.
- **Fixed in this pass:** users can now trigger deletion themselves at any time (§6) — this is the actual retention control available today, rather than a passive time-based one.

## 6. Deletion behavior

**Before this pass: there was no deletion or export feature anywhere in the app** — not even a UI stub. Logout also did not clear most of the sensitive data cached in `localStorage`.

**Fixed in this pass:**
- `GET /api/privacy/export` and `DELETE /api/privacy/data` (`backend/routers/privacy_router.py`) — real, working, scoped strictly to the caller's own `user.id` (never a cross-user query; verified by dedicated tests in `backend/tests/test_privacy_export_delete.py`, including that another user's data survives untouched). Deletion respects FK ordering (children before parents) since none of the relevant foreign keys cascade automatically.
- A "Your Data" section in `src/pages/user/UserSettings.jsx` wired to both endpoints — an actual download of a JSON file and a confirm-then-delete flow that signs the user out afterward.
- `logout()` now clears every NeuroBridge-namespaced `localStorage` key (`src/lib/clearLocalAppData.js`), not just the one profile key — closing the "next person on a shared device can read the previous user's OCD journal out of localStorage" gap.
- Supabase-native tables the frontend writes directly (`reading_files`, `reading_sessions`, `phoneme_errors`, `cognitive_profiles`, etc.) are **not** included in the backend export/delete, since this backend has no service-role access to them by design; the export response says so explicitly rather than silently omitting them.

**Residual limitation:** deleting the underlying Supabase *authentication* account (not just app data) requires a service-role key (`SUPABASE_SERVICE_ROLE_KEY`), which is optional and unset by default — without it, `/api/privacy/data` deletes all application data but leaves the sign-in account itself intact, and says so in its response rather than claiming full account deletion.

## 7. Encryption/security mechanisms

- **In transit:** HTTPS is expected from the hosting platform (Vercel/whatever serves the FastAPI app) — not independently enforced by the app itself (no HSTS header, no forced-HTTPS middleware). This is a common and reasonable pattern behind a managed platform, but it is a trust assumption, not a verified guarantee in code.
- **At rest:** Postgres/Supabase-managed storage; no additional application-level encryption of sensitive columns (journal text, notes) — relies entirely on Supabase's platform-level encryption at rest and access control.
- **Row-level isolation:** two different mechanisms depending on access path (§2) — both verified correct by tests, but they are *different* mechanisms, which is worth knowing operationally (a mistake in `DATABASE_URL`'s connection role is the one way the FastAPI-owned tables' isolation could quietly fail; a missing/misconfigured RLS policy is the equivalent risk on the Supabase-native tables).
- **Storage bucket:** `reader-files` (user-uploaded reading documents) was created **public** — meaning `getPublicUrl()` served every uploaded document to anyone with the URL, with **no authentication check at all**, regardless of the correctly-written per-owner storage RLS policies (those policies only govern the authenticated Storage API, not a public bucket's direct object URLs). **Fixed in this pass**: new migration flips the bucket to private (`20260910010000_reader_files_bucket_private.sql`), and `readingFilesService.js` now requests short-lived signed URLs (1 hour) instead of permanent public ones.
- **Secrets:** `.env` is gitignored and not tracked; `.env.example`/`.env.production` contain no real secrets. `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` (new, optional) exist only server-side, never `VITE_`-prefixed.
- **Auth:** Supabase-issued JWTs verified server-side per-request against Supabase's own `/auth/v1/user` endpoint (60s in-process cache); a deliberately-scoped `demo:` pseudo-token path exists for the no-signup demo mode, restricted to a hardcoded allowlist of 3 non-sensitive demo identities and namespaced so it can never collide with a real user id.
- **Rate limiting:** in-process sliding-window limiters (shared `backend/services/rate_limiter.py`) on agent chat, OCD AI-write endpoints, and now the new general AI proxy — bounds both cost exposure and abuse, though it is per-process (would need a shared store to be correct under multi-worker/horizontal scaling — noted as a known limitation, not fixed here).
- **CORS:** explicit origin allowlist via `CORS_ALLOWED_ORIGINS`, no wildcard, `allow_credentials=True` paired correctly with that explicit list (not `*`).

## 8. Remaining risks / limitations (not fixed in this pass)

1. **ABHA health ID and disorder labels are cached in plaintext `localStorage`** (`nb_auth`/`nb_prefs_*`) for snappy reload. Logout now clears this, but *while signed in*, this data is readable by any XSS payload or malicious browser extension with page access — the standard SPA-session-cache trade-off, but worth flagging given the sensitivity of what's cached here specifically. A stronger fix (e.g., never caching ABHA ID/disorders client-side, always refetching from the session) would require a broader auth-architecture change than this pass's scope.
2. **ABHA ID edits are never synced to Supabase** — `UserSettings.jsx`'s `updateUser()` only ever persists to `localStorage`, never to `user_metadata` via `supabase.auth.updateUser()`. A real user's ABHA ID entry today only survives on the device/browser they entered it on. This is a functional gap as much as a privacy one.
3. **No automatic time-based data retention** — deletion is now user-triggered (§6) but nothing purges old data on its own (e.g., agent action logs older than N months). Not implemented here; would need a scheduled job.
4. **TLS/security headers are not enforced by the app itself** — relies on the hosting platform.
5. **Per-process rate limiting** — correct for a single worker, not for horizontal scaling. Would need Redis or similar to be correct under multiple workers/instances.
6. **OCD journal/ERP content is inherently sent to a third-party model provider (Google Gemini)** for the AI-assist features — de-identified (no user id/name attached) but the clinical content itself is real. No per-entry opt-out exists.
7. **Full Supabase auth-account deletion is optional/best-effort**, gated on an operator setting `SUPABASE_SERVICE_ROLE_KEY`; without it, only application data is deleted.
8. **No content-level PII scrubbing** before OCD journal/ERP text reaches Gemini — mitigated only by not attaching an identifier, not by redacting the content itself.

---

## Fixed in this pass — summary

| Fix | File(s) | Why |
|---|---|---|
| Removed all 5 direct-from-browser Gemini calls; added authenticated, rate-limited backend proxy | `backend/routers/ai_proxy_router.py`, `src/lib/geminiProxyClient.js`, `src/lib/backendAuth.js`, + 5 call sites | Client-bundled API key was extractable by anyone; no auth/rate-limit/visibility on those calls |
| Real, working data export & deletion, scoped per-user | `backend/routers/privacy_router.py`, `src/pages/user/UserSettings.jsx` | The app collects self-reported mental-health/neurodivergence data with no prior way for a user to see or erase it |
| `reader-files` Supabase Storage bucket made private; signed URLs replace permanent public URLs | new migration, `src/lib/readingFilesService.js` | Public bucket served uploaded personal documents to anyone with the URL, bypassing RLS entirely |
| Logout clears all NeuroBridge localStorage keys, not just one | `src/lib/clearLocalAppData.js`, `src/context/AuthContext.jsx` | Sensitive OCD/ASD/guardian data survived sign-out on shared devices |
| Removed payload-logging in mock dyslexia API stubs | `src/support/api/dyslexiaApi.js` | Free-text reading/writing samples were printed to the browser console |
| Removed unused raw-audio-capture hook | deleted `src/hooks/useVoiceRecording.js` | Dead code capable of retaining raw audio, never wired into any screen — data-minimization cleanup |
| Added missing cross-user isolation tests for the most sensitive table | `backend/tests/test_ocd_isolation.py` | `OCDJournalEntry` (raw OCD symptom text) was the one domain without a dedicated isolation test |

## Testing performed

- Backend: full suite — **173 passed**, including 4 new export/delete tests and 2 new journal-isolation tests.
- Frontend: `aiService.test.js` (17), `evaluationService.test.js` (17), `scenarioGenerator.test.js` (9), `emotionDecoderService.test.js` (8), `socialScenarioEvaluation.test.js` (8), `socialScenarioService.test.js` (9), `contextEngine.test.js`, `moodAgentInteraction.test.js` — all passing after the Gemini-proxy migration.
- `npx vite build` succeeds; the production bundle was grepped and confirmed to contain **zero** references to `VITE_GEMINI_API_KEY` or a Gemini API key.
- `npx eslint` on every changed file: 0 errors.
