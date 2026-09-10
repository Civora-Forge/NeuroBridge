# NeuroBridge Accessibility Audit (WCAG 2.2 AA)

**Date:** 2026-09-10
**Scope of this pass:** shared infrastructure (design tokens, global CSS, `AppLayout`, core `ui/` components) + the agentic AI chat (`AgentChat`, `useAgentVoice`, `useVoiceRecording`) + voice interaction + `SensorySettings` (the accessibility/personalization preferences panel) + representative disorder-module screens (`ModuleCard`, OCD hub, `SUDSMonitor`). This was agreed with the requester as "deep on shared infra + agent/voice" rather than a shallow pass over all ~40+ screens, because the app has 452 source files and a real audit of that whole surface at genuine depth is not achievable in one pass. **Screens outside this list were not individually audited** — see "What remains" below for the explicit list.

This report is code-verified: every "Implemented fix" below is an actual diff in this branch, and every "Verified" line was checked either by contrast-ratio calculation against the actual CSS custom properties in [`src/index.css`](../src/index.css), or by driving the running app in a browser (DOM inspection of ARIA attributes, keyboard-only interaction, focus tracking).

---

## 1. Findings and fixes

### 1.1 Global / shared infrastructure

| # | Issue | WCAG SC | Severity | Current behavior (before) | Fix |
|---|---|---|---|---|---|
| G1 | No skip-to-content link | 2.4.1 Bypass Blocks (A) | High | Keyboard users had to tab through the entire sidebar nav (10+ links) on every page to reach the main content. | Added a `.skip-to-content` link, first in DOM, visible on focus, jumps to `#main-content`. **[AppLayout.jsx](../src/components/AppLayout.jsx), [index.css](../src/index.css)** |
| G2 | Inconsistent/absent focus indicator | 2.4.7 Focus Visible (AA) | High | Most components used shadcn's `focus-visible:ring-*` utilities, but plain `<Link>`/`<button>` elements outside `ui/` (sidebar nav, `.neuro-btn-*`, most page-level buttons) had no explicit focus style — relying on the browser default only, which some custom `outline`-clearing utility classes could silently defeat page-by-page. | Added one `:focus-visible { outline: 3px solid hsl(var(--ring)); outline-offset: 2px }` rule in `@layer base`, applying everywhere, keyboard-only. |
| G3 | `--muted-foreground` text token measured ~4.49:1 on `--card`/`--background` | 1.4.3 Contrast (Minimum) (AA) | Medium | Just under the 4.5:1 threshold for normal text — used for secondary text across most of the app (labels, captions, helper text). | Darkened lightness 50%→46% (same hue/chroma) → **4.9:1**. One-line, systemic fix in `index.css`. |
| G4 | Manual "reduce motion" toggle existed, but the OS-level `prefers-reduced-motion` setting was ignored | 2.3.3 Animation from Interactions (AAA, applied as best practice) | Low–Medium | A user who already told their OS "no motion" still saw every animation unless they *also* found and set NeuroBridge's own Animation control. | Added a `@media (prefers-reduced-motion: reduce)` block that applies the same "kill all CSS animation/transition" rule the app's own low-stimulation preset uses. |

**Verified:** contrast ratios computed against the actual HSL values in `index.css` (not estimated); skip-link and focus-ring verified live via the running dev server (see §3).

**Not fixed / partial:** G4 only covers CSS `animation`/`transition`. Several disorder-module pages (`SUDSMonitor` and others) animate with **framer-motion**, which drives inline styles via JS/RAF, not CSS transitions — so the CSS media query does *not* silence those. `SensorySettings.jsx` itself was converted to call `useReducedMotion()` and skip its own expand/collapse animation, as a worked example, but the same conversion was not done for every `motion.*` usage app-wide (this is a real, repeated pattern — see "What remains").

---

### 1.2 `AppLayout` (navigation shell, present on every page)

| # | Issue | WCAG SC | Severity | Current (before) | Fix |
|---|---|---|---|---|---|
| L1 | Mobile header's Settings and Sign-out controls were icon-only with no accessible name | 4.1.2 Name, Role, Value (A) / 2.5.3 Label in Name (A) | High | `<Link><Settings/></Link>` — a screen reader announces "link" with no label. | Added `aria-label="Settings"` / `aria-label="Sign out"` / `aria-label="Sign in"`, and `aria-hidden="true"` on the now-redundant icons. |
| L2 | `<aside>` sidebar and mobile `<nav>` had no accessible name | 1.3.1 Info and Relationships / 2.4.1 (A) | Medium | A screen reader's landmark list showed an unlabeled "navigation" and an unlabeled "complementary" region, indistinguishable from any other. | Added `aria-label="Main navigation"` (aside), `aria-label="Modules"` (desktop `<nav>`), `aria-label="Account"` (mobile header, now itself a `<nav>` instead of a bare `<div>`). |
| L3 | `<main>` had no landmark focus target | 2.4.1 | Medium | Skip link (G1) had nothing to move focus to programmatically. | Added `id="main-content" tabIndex={-1}` so the skip link both scrolls *and* moves keyboard focus. |
| L4 | Several purely-decorative icons (brand mark, role badge, per-module nav icons) were exposed to screen readers alongside their text label, adding noise | 1.1.1 Non-text Content (A) — correct use, not a violation, but noisy | Low | Every module nav item was announced as e.g. "icon Focus Flow link" — icon has no meaningful name so browsers usually skip it, but this varies. | Added `aria-hidden="true"` to all icons that sit next to visible text. |

**Verified:** live DOM read via `read_page` — mobile-header links now list with their `aria-label`; `Settings`/`Sign out` show correctly in the interactive-elements list.

---

### 1.3 Agentic AI chat (`AgentChat.jsx`, `useAgentVoice.js`) — the highest-priority area per the brief

This was the main focus of the "agentic AI accessibility" requirement. Before this pass, the widget had good aria-labels on individual icon buttons already, but the panel itself was not usable by keyboard/screen-reader users as a self-contained unit, and agent *state* was visual-only in practice even though the text existed.

| # | Issue | WCAG SC | Severity | Current (before) | Fix |
|---|---|---|---|---|---|
| A1 | Chat panel was a floating `<div>` with no dialog semantics, no focus management, no keyboard trap, no Escape-to-close | 2.4.3 Focus Order (A), 2.1.2 No Keyboard Trap (A), 4.1.2 (A) | **Critical** | Opening the widget left keyboard focus wherever it already was (often behind the panel); Tab could leave the panel into page content behind it; there was no keyboard way to close it. | Added `role="dialog" aria-modal="true" aria-labelledby`; on open, focus moves into the panel (input, or first button if the agent isn't usable yet); on close, focus returns to the toggle button; a `Tab`-cycle trap keeps focus inside while open; `Escape` closes it. |
| A2 | Agent state ("Listening"/"Thinking"/"Speaking"/"Ready") was rendered as plain text with no live-region semantics | 4.1.3 Status Messages (AA) | **Critical** — this is the literal "agent state should not be communicated only through animation" requirement | The state text existed visually (good) but a screen reader user with the panel open and focus elsewhere in it would not hear state changes as they happened — nothing announced the transition. | Added `role="status" aria-live="polite"` to the state text itself, **plus** a separate always-mounted `sr-only` live region that mirrors finalized replies, confirmation prompts, and errors — so state and content changes are announced even if the visible bubble's own fragile per-message `aria-live` toggle (see A3) misses the moment. |
| A3 | Each message bubble toggled `aria-live` on/off based on `streaming`, and the toggle-off happened in the *same* render as the final content landing — a live region's content changing in the same tick its `aria-live` attribute is added is unreliable across screen readers | 4.1.3 Status Messages (AA) | High | Final agent answers were not reliably announced. | Left the per-bubble behavior as a visual/redundant mechanism but added the stable `sr-only` status region (A2) as the primary, reliable announcement path — it updates only once, exactly when a message finalizes. |
| A4 | Text input had no accessible label (placeholder-only) | 3.3.2 Labels or Instructions (A) / 4.1.2 | Medium | Screen readers do not treat `placeholder` as a label; it also disappears once text is typed. | Added `aria-label="Message to the assistant"`. |
| A5 | Live voice transcript ("Listening… {transcript}") had no live-region markup | 4.1.3 | Medium | A screen reader user speaking to the agent would not hear their own recognized text as it updated. | Added `role="status" aria-live="polite"`. |
| A6 | Various informational icons inside the chat (spinner, mic, volume, checkmarks) were exposed to assistive tech even though paired with visible text | 1.1.1 (correct-use / noise) | Low | Redundant "icon" announcements inside an already form of text | Added `aria-hidden="true"` throughout. |

**Confirmation prompts** (`PendingConfirmationCard`): these already render as normal focusable buttons ("Cancel"/"Confirm") reachable by Tab, and are now additionally announced via the A2 live region ("Confirmation required before continuing.") the instant they appear — addressing the brief's explicit "Confirmation prompts must be accessible" and "tool execution results must be announced" requirements.

**Text vs. voice equivalence:** confirmed by reading the component — every agent action reachable by voice (start listening → speak → auto-submit) has an exact text equivalent (type → Enter), and the "yes"/"no" hands-free confirmation path (`isAffirmativeConfirmation`/`isNegativeConfirmation`) is driven off the *same* text string whether it was typed or transcribed by speech recognition — voice is additive, not required, for every agent capability observed in this component.

**Verified live** (see §3 for method): opened the panel with the mouse, confirmed via `document.activeElement` that focus landed on the message input; confirmed `role="dialog"`, `aria-modal="true"`, `aria-labelledby` resolve to "NeuroBridge Assistant"; pressed `Escape` and confirmed the panel unmounted and focus returned to the "Open AI Assistant" button. Did **not** verify with a real screen reader (NVDA/JAWS/VoiceOver) — see "What remains."

---

### 1.4 Voice interaction (`useVoiceRecording.js`, `useAgentVoice.js`)

| # | Issue | WCAG SC | Severity | Current behavior | Assessment |
|---|---|---|---|---|---|
| V1 | Microphone permission / unsupported-browser states | 3.3.1 Error Identification (A) | — | Already handled well: distinct, specific copy for `NotAllowedError`, `NotFoundError`, `NotReadableError`, no-SpeechRecognition-support, network failure vs. hard failure (network errors are downgraded to non-blocking warnings). No fix needed. | **Pass** |
| V2 | Cancel/interrupt while listening | 2.1.1 Keyboard (A) | — | `cancelListening`/`stopListening` are both real buttons with `aria-label`s, reachable by keyboard, already present before this pass. | **Pass** |
| V3 | Text fallback for every voice action | — | — | Confirmed: nothing in the reviewed voice flow requires speech; every action has a typed/clicked equivalent. | **Pass** |
| V4 | Visual-only listening indicator (pulsing red dot) | 1.4.1 Use of Color | Low | The dot is paired with the word "Listening" in text next to it (not color-only), so this is not a strict 1.4.1 violation, but the dot itself was not `aria-hidden` before this pass. | Fixed as part of A6. |

---

### 1.5 `SensorySettings.jsx` (the accessibility/personalization panel itself)

Auditing NeuroBridge's *own* accessibility-preferences UI for accessibility bugs was treated as especially important — a broken settings panel undermines every preference a user sets there.

| # | Issue | WCAG SC | Severity | Current (before) | Fix |
|---|---|---|---|---|---|
| S1 | Preset buttons and segmented controls didn't expose selection state to assistive tech | 4.1.2 (A) | Medium | Selection was color/shadow-only (`border-[#4F6BF6] bg-[#F0F4FF]`) | Added `aria-pressed={isSelected}` to preset buttons (segmented-control buttons already had it). |
| S2 | Expand/collapse button had `aria-expanded` but no `aria-controls` link to the panel it disclosed | 4.1.2 / 1.3.1 | Low | Screen readers could not associate the toggle with its target region. | Added matching `id`/`aria-controls` via `useId()`. |
| S3 | Panel used hardcoded hex colors (`#6B7BA8`, `#4F6BF6`, `#C7D2FE`, `#1E2A5E`, `#F0F4FF`) instead of the app's theme tokens | 1.4.3 Contrast (AA) | High | `#6B7BA8` on white measured **~4.18:1** and `#4F6BF6` measured **~4.40:1** — both text/UI uses were below the 4.5:1 threshold for the ~11px text they were used on. These colors also had no dark-mode variant, unlike every other token in the app. | Replaced all five with the existing semantic tokens (`text-muted-foreground`, `text-primary`, `text-foreground`, `border-border`, `bg-card`/`bg-secondary`/`bg-primary/5`), which are already tuned for both themes and (after fix G3) measure ≥4.5:1. |
| S4 | Expand/collapse animation ignored `prefers-reduced-motion` | 2.3.3 (AAA best practice) | Low | framer-motion height/opacity animation always ran. | `useReducedMotion()` now skips the animation (duration 0, no from/to transform) when the OS preference is set. |

**Note:** while implementing this, a concurrent edit (from another active session working in this repo) landed on this same file fixing an unrelated real bug — the Visual Intensity control wrote `dataset.sensoryVisual` but the CSS actually selected `[data-sensory-visual-intensity=...]`, so that control silently did nothing. That fix is now merged into the same file; it is **not** part of this audit's changes, but is worth knowing about since it means Visual Intensity now actually works, which it may not have during earlier testing.

---

### 1.6 Representative disorder-module screens (`ModuleCard`, OCD hub, `SUDSMonitor`)

| # | Issue | WCAG SC | Severity | Current (before) | Fix |
|---|---|---|---|---|---|
| M1 | `ModuleCard` "Open →" links were indistinguishable out of context (every module tile said just "Open") | 2.4.4 Link Purpose (A) | Medium | A screen reader's "list all links" view showed 8–9 identical "Open →" entries on the home page. | `aria-label={`Open ${title}`}`. |
| M2 | `ModuleCard` used hardcoded `bg-white`/`text-slate-900`/`text-slate-500` instead of theme tokens | 1.4.3 / theming consistency | Low | Fine in light mode; inconsistent with the token system used everywhere else, so it would look wrong if dark mode is ever enabled for this card | Switched to `bg-card`/`text-foreground`/`text-muted-foreground`. |
| M3 | OCD hub mood-check buttons had no pressed-state for assistive tech | 4.1.2 | Low | Same "color/scale-only selection" pattern as S1. | Added `aria-pressed`. |
| M4 | `SUDSMonitor`: back-arrow link was icon-only, no accessible name | 4.1.2 / 2.5.3 | High | `<Link to="/ocd"><ArrowLeft/></Link>` | `aria-label="Back to Exposure Practice"`. |
| M5 | `SUDSMonitor`: the SUDS (distress) `<input type="range">` had no accessible name at all | 3.3.2 / 4.1.2 | **Critical** | A keyboard/screen-reader user tabbing to the main "how are you feeling" control would hear only "slider, 50" with zero context — on a mental-health self-report tool, this is the single most important control on the page. | `aria-label="Distress level (SUDS), 0 to 100"` and `aria-valuetext` announcing both the number and its word ("50 out of 100, Moderate"). |
| M6 | `SUDSMonitor`: context tags (Before compulsion / During exposure / etc.) had no pressed state | 4.1.2 | Medium | Same pattern as S1/M3. | Added `aria-pressed`. |
| M7 | `SUDSMonitor`: form labels ("Context", "Note (Optional)") and the footer disclaimer used `text-slate-400` | 1.4.3 (AA) | High | `#94a3b8` on white measured **~2.56:1** — a severe fail, on actual form labels, not decorative text. | Bumped to `text-slate-600` (**~7:1**, comfortably passing). |
| M8 | `SUDSMonitor`: the two Recharts (distress trend line, context bar chart) had no text alternative | 1.1.1 Non-text Content (A) | High | An SVG chart with zero accessible name or description — screen reader users got nothing. | Added `role="img"` + a generated `aria-label` summarizing the data (range and latest reading for the line chart; per-context counts/averages for the bar chart). This is a **minimum viable fix** (a live summary string), not a full accessible-data-table alternative — see "What remains." |

**Color-independence check (this was explicitly requested):** the SUDS severity indicator ("Calm"/"Mild"/"Moderate"/"High"/"Intense") already renders as visible text next to every colored number, on the main scale, the daily timeline cards, and the weekly-average tiles — so despite heavy use of color (emerald→amber→orange→rose), this was **already compliant** with 1.4.1 Use of Color before this pass; no fix needed here, called out as a pass.

---

## 2. Summary by area

| Area | Status |
|---|---|
| Skip navigation, landmarks, global focus indicator | **Fixed** |
| Text contrast (global `muted-foreground` token) | **Fixed** (recalculated, now ≥4.5:1) |
| Reduced motion (CSS-driven) | **Fixed**; framer-motion-driven animation only partially converted (see below) |
| Agent chat: dialog semantics, focus trap, Escape, focus return | **Fixed** |
| Agent chat: state announced to assistive tech (not animation-only) | **Fixed** |
| Agent chat: confirmation prompts announced | **Fixed** |
| Agent chat: text/voice functional equivalence | **Verified — already true**, not a fix |
| Voice: permission/error/cancel UX | **Verified — already good**, not a fix |
| `SensorySettings` panel: contrast, pressed-state, reduced motion | **Fixed** |
| Icon-only controls in `AppLayout` (mobile header) | **Fixed** |
| Representative dashboard (`SUDSMonitor`): range slider label, chart alt text, label contrast, back-link label | **Fixed** |
| Color-independent status indicators (SUDS severity) | **Verified — already compliant** |
| Full keyboard/screen-reader audit of all ~40 other screens, modals, forms | **Not done this pass** — scoped out, see below |
| Real assistive-technology testing (NVDA/JAWS/VoiceOver/TalkBack) | **Not done** — see below |
| Automated tooling (axe/Lighthouse) run across the app | **Not done** — see below |

---

## 3. Verification method actually used

- **Build**: `npx vite build --mode development` — succeeds, no new errors introduced.
- **Live browser testing** (this session's own dev server, port 5199, separate from another chat's server already running on the project's default port): logged in via Demo Access, confirmed via DOM inspection (`document.activeElement`, `getAttribute`) that:
  - the skip link exists and targets `#main-content`;
  - opening the agent chat panel sets `role="dialog"`, `aria-modal="true"`, resolves `aria-labelledby` to "NeuroBridge Assistant", and moves focus into the message input;
  - pressing `Escape` closes the panel and returns focus to the "Open AI Assistant" button;
  - mobile-header icon links resolve to `aria-label`s ("Settings", "Sign out") in the interactive-element tree.
  - No new console errors.
- **Contrast ratios**: calculated by hand from the actual HSL/hex values in the codebase (relative luminance / WCAG contrast formula), not estimated.
- **What was *not* done**: no automated scanner (axe-core, Lighthouse, WAVE) was run — this repo has no such tooling wired in yet. No testing with an actual screen reader (NVDA, JAWS, VoiceOver, TalkBack) — the verification above used the DOM/ARIA tree as a proxy, which catches structural issues but cannot confirm actual announcement behavior, timing, or screen-reader-specific quirks. No testing on real mobile devices or with real switch/keyboard-only hardware.

---

## 4. What remains (explicitly not covered by this pass)

**Screens not individually audited:** every module's secondary screens beyond the ones listed above — ADHD (`FocusSessions` was touched by a concurrent in-flight change but not independently audited here), ASD daily routines, Dyslexia reading tools, Dyscalculia dashboard, Dyspraxia tools (`RoutineScheduler`, `SpatialAwarenessTrainer`, `GamifiedMotorExercises`, AR/haptic tools), APD, Anxiety toolkit pages beyond what's referenced, Depression (`VoidWhisper`), onboarding/questionnaire flow, admin dashboard, guardian/support dashboards, login flows, and all modal/dialog usages outside `ui/dialog.jsx` and the agent chat. Given the "deep on shared infra" scope this session was asked to take, these were deliberately left out rather than given a shallow pass that could give false confidence.

**Known repeated patterns not swept app-wide:**
- Hardcoded Tailwind grays (`text-slate-400`, `text-slate-300`, etc.) bypassing the theme-token system appear in many files beyond the ones fixed here; each instance needs the same contrast check applied to `SUDSMonitor` above.
- framer-motion (`motion.div`/`AnimatePresence`) is used directly, without `useReducedMotion()`, in most disorder-module pages — the global CSS reduced-motion fix (G4) does not reach these; each needs the same treatment applied to `SensorySettings.jsx`.
- Chart accessibility (`role="img"` + generated summary) was applied only to `SUDSMonitor`'s two charts; other Recharts usages elsewhere in the app were not touched.
- Icon-only buttons/links without `aria-label` are a recurring pattern; only the instances actually encountered in the audited files were fixed.

**Not verified at all:**
- Real screen reader behavior (see §3).
- Full keyboard walkthrough of every modal/dialog in the app (only `ui/dialog.jsx`, which wraps Radix — itself handles focus-trapping/Escape correctly by default — and the custom `AgentChat` panel were checked).
- Color contrast of every color combination in the app; only the tokens and specific instances listed above were measured.
- Zoom/reflow behavior at 200%/400% text scaling (WCAG 1.4.10 Reflow, 1.4.4 Resize Text) was not tested, though the app does have a manual text-scale preference (`SensorySettings`) which is a different mechanism from browser zoom and doesn't substitute for verifying reflow.
- Automated tooling coverage (no axe/Lighthouse/WAVE run).

---

## 5. How to honestly describe this during a presentation

**Do not say** "NeuroBridge is WCAG 2.2 AA compliant." That claim is not supportable from what was actually done here — compliance requires verified coverage of the *entire* application, including automated + manual testing and real assistive-technology validation, none of which happened for most of the ~40+ screens.

**What you can accurately say:**

> "We ran a genuine, code-level accessibility audit — not a documentation exercise — focused on the parts of NeuroBridge that carry the most accessibility risk: the shared navigation shell, the design-token system, and — critically — the new agentic AI assistant and its voice interaction, since an inaccessible AI agent would undermine the whole product's premise. We found and fixed real, confirmed issues: missing keyboard focus management and screen-reader announcements in the agent chat panel (agent state, confirmation prompts, and replies are now announced via ARIA live regions, not just shown visually), a below-threshold color-contrast value used app-wide, several icon-only controls with no accessible name, a completely unlabeled input control on our anxiety self-report tool, and missing text alternatives on two data visualizations. Every fix was verified either by contrast-ratio calculation against our actual design tokens or by driving the running app and inspecting real ARIA state and keyboard focus behavior.
>
> We have **not yet** completed an audit of every individual screen, have not run automated accessibility scanning tooling, and have not tested with a real screen reader (NVDA/JAWS/VoiceOver) or real assistive hardware — all three are the logical next steps, and we can scope and schedule them. Until that's done, the honest framing is: **'actively and substantively working toward WCAG 2.2 AA, with the highest-risk surfaces (navigation, design tokens, the AI agent, voice) audited and fixed,' not 'certified compliant.'**"

---

## 6. Suggested next steps (not implemented in this pass)

1. Wire up `axe-core` (or `@axe-core/react` in dev mode) for continuous automated scanning — catches a large class of issues (contrast, labels, ARIA misuse) automatically and cheaply, going forward.
2. One real screen-reader pass (NVDA + Chrome is the cheapest combination) through: login, onboarding, agent chat end-to-end (including a confirmation flow and a voice interaction), and one full disorder-module flow per module.
3. Sweep the two repeated patterns identified above (hardcoded grays, un-reduced-motion `framer-motion` usage) across the remaining files — both are mechanical, low-risk fixes once flagged, just numerous.
4. Extend the chart accessibility fix (M8's pattern) to the other Recharts usages in the codebase, and consider a real "view as table" toggle for the most data-dense charts rather than only a summary `aria-label`.
5. A zoom/reflow pass at 200% and 400% browser zoom on the three or four most content-dense screens.
