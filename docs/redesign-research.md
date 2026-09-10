# Redesign Research Synthesis

Evidence-grounded UX guidance for NeuroBridge, targeting children with ADHD, autism/ASD, dyslexia, dyscalculia, anxiety, and OCD. Each section gives the core finding, the source, and concrete implications for implementation. Where evidence is mixed or individual variability is high, this is flagged explicitly — the correct answer there is a **user-configurable setting**, not a single "best" default.

---

## 1. ADHD

**Finding:** ADHD interfaces fail when they demand sustained working memory, present unfiltered choice, or use urgency/countdown mechanics that spike impulsivity. What helps: short line lengths, large sans-serif text, calm/muted color palettes, minimal motion, and flexible (not strict) pacing. Progress bars and small, frequent wins support task initiation better than long-horizon goals.

**Source:** [designmonks.co — UI/UX and ADHD](https://www.designmonks.co/blog/ui-ux-and-adhd), [accessibilitychecker.org — Neurodivergent UX Design](https://www.accessibilitychecker.org/blog/neurodivergent-ux-design/), [monstermath.app — ADHD-Friendly App Design](https://www.monstermath.app/blog/adhd-friendly-app-design-what-to-look-for-and-what-to-avoid)

**UI implications:**
- Lines of text ≤ ~70 characters; large sans-serif fonts; generous whitespace between sections.
- No auto-playing video, no aggressive animation, no pop-ups competing with the primary task.
- Replace hard countdown timers with flexible/pausable pacing; break multi-step tasks into single-focus screens (one primary action visible at a time).
- Use visible, incremental progress indicators for task initiation (a task list showing "1 of 4" beats an abstract completion %).

---

## 2. Autism / ASD

**Finding:** Autistic users often have a visual-processing strength but are vulnerable to sensory overload from clutter, motion, and unpredictable layout changes. Predictability of navigation position, literal unambiguous language (no idioms/sarcasm), and user control over sensory stimuli (sound, animation, haptics) are the load-bearing design levers — more so than any single aesthetic choice.

**Source:** [Aspect Autism Friendly Visual Design Guidelines (2024/2025 PDF)](https://www.aspect.org.au/uploads/documents/Aspect-Autism-Friendly-Design-Guide-July-2025.pdf), [UXPA International — Designing for Autism in UX](https://uxpa.org/designing-for-autism-in-ux/), [accessibility.com — Sensory-Friendly Design](https://www.accessibility.com/blog/sensory-friendly-design-creating-digital-spaces-that-support-autistic-users)

**UI implications:**
- Keep navigation, key controls, and page structure in the exact same position across every screen; avoid redesigning layouts between app updates without warning/opt-in.
- Global toggle to disable animation, autoplay, and sound effects (default off is safest, not just adjustable).
- Use literal microcopy — label icons with text, avoid idioms/sarcasm/rhetorical questions in prompts.
- Provide a visible "what happens next" preview before transitions (e.g., before starting an exercise, show the steps and expected duration up front).

---

## 3. Dyslexia

**Finding — mixed evidence, configurability is correct:** Specialized "dyslexia fonts" (OpenDyslexic in particular) have thin/inconsistent evidence of outperforming standard sans-serif fonts. The more robust, replicated finding is that **increased letter/word spacing measurably reduces reading errors** (~20% fewer errors in controlled study, without slowing reading speed), and that **shorter line length (roughly 50–75 characters), left alignment, larger minimum font size (≥18px for body text), and default-to-generous line height** matter more consistently than font family itself.

**Source:** [Springer/PMC — Inter-letter spacing, inter-word spacing, and font with dyslexia-friendly features](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7188700/) (Zorzi et al. spacing study), [disabilityworld.org — Inclusive Typography](https://www.disabilityworld.org/articles/inclusive-typography-and-readability/), [ResearchGate — Comparative Study of Dyslexia Style Guides](https://www.researchgate.net/publication/347481260_A_Comparative_Study_of_Dyslexia_Style_Guides_in_Improving_Readability_for_People_With_Dyslexia)

**UI implications:**
- Do NOT hard-code a single "dyslexia font" as the fix. Offer a **reading-settings panel**: font choice (system sans-serif, Atkinson Hyperlegible, OpenDyslexic as options — not a forced default), adjustable letter/word spacing, adjustable line height, adjustable text size.
- Default body text: sans-serif, ≥18px, line length capped around 60–75 characters via max-width containers, left-aligned (never justified).
- Pair with text-to-speech / read-aloud for any substantial passage, and chunk long text into short paragraphs with headings rather than walls of text.

---

## 4. Dyscalculia

**Finding:** The concrete-representational-abstract (CRA) progression — physical/visual manipulatives → pictorial representations → abstract symbols — is the dominant evidence-based framework for building number sense in dyscalculia. Number lines are a specifically effective visual device because they convert arithmetic into spatial movement (addition = forward jump, subtraction = backward step), which is more accessible than symbol manipulation alone. Non-timed, low-stakes practice with adaptive pacing shows better engagement than timed drills.

**Source:** [touchmath.com — Understanding Dyscalculia: Insights from Cognitive Science](https://touchmath.com/understanding-dyscalculia-insights-from-cognitive-science/), [monstermath.app — Research-Backed Visual Math Tools](https://www.monstermath.app/blog/7-visual-math-tools-neurodiverse-learners-love), [dyscalculia.org — Best Tools](https://www.dyscalculia.org/math-tools)

**UI implications:**
- Never present a math task as symbols-only; pair every numeric operation with a visual/spatial representation (number line, grouped objects, bar model) that can be toggled off once mastery is confirmed, not removed by default.
- No countdown timers on math tasks; use adaptive difficulty/pacing instead of fixed time limits.
- Let numeric answers be entered via visual/interactive input (drag counters, tap a number-line position) as an alternative to typing digits.

---

## 5. Anxiety

**Finding:** Calm is a behavioral property of an interface, not a color palette — predictability, forgiving error-handling, and absence of surprise interruptions matter more than aesthetics. Countdown timers and hard time limits are a well-documented anxiety trigger even when the time given is objectively sufficient; the fix is removing the ticking visual and replacing it with reassuring, actionable copy ("Take your time" / "Request more time if needed"). Batched, user-controlled notifications reduce anxiety versus real-time interrupt-driven alerts.

**Source:** [TetraLogical — Designing for people with anxiety](https://tetralogical.com/blog/2026/03/10/designing-for-people-with-anxiety/), [UXmatters — Designing Calm: UX Principles for Reducing Users' Anxiety](https://www.uxmatters.com/mt/archives/2025/05/designing-calm-ux-principles-for-reducing-users-anxiety.php), [Vispero/TPGi — A Web of Anxiety, Part 2](https://vispero.com/resources/a-web-of-anxiety-accessibility-for-people-with-anxiety-and-panic-disorders-part-2/)

**UI implications:**
- Eliminate visible countdown clocks and red urgency indicators anywhere avoidable; where a time limit exists (e.g., a session), use neutral color and offer an easy extend action.
- No surprise modals/pop-ups during a focused activity; all interruptions should be dismissible and queued for a natural break point.
- Copy tone: supportive and non-evaluative ("Let's try that again" not "Incorrect" / "You failed"). Avoid red-flashing error states — use neutral/blue tones with calm wording.
- Batch and let users control notification frequency and quiet hours.

---

## 6. OCD — critical: avoid reinforcing compulsions

**Finding:** This is the one area where a "helpful"-looking engagement pattern can be actively harmful. IOCDF research on digital reassurance-seeking shows apps/platforms readily become part of the checking-compulsion cycle: repeatedly re-checking a logged status, seeking "you did it right" confirmation, or algorithmically-served reassurance content all reinforce OCD rather than treat it. Streaks, badges, and repeated "are you sure?" confirmation loops are exactly the mechanics that map onto compulsive checking and reassurance-seeking behavior, even though they're standard "good UX" or "gamification" elsewhere in the app.

**Source:** [IOCDF — Digital Reassurance Seeking in OCD](https://iocdf.org/blog/2026/07/21/digital-reassurance-seeking-in-ocd/), [ocd.app — Reassurance-seeking vs. seeking support](https://ocd.app/ocd-reassurance-seeking-vs-seeking-support/)

**UI implications:**
- **Do not** show streak counters, "days completed in a row," or loss-framed streak-break warnings on therapeutic/exposure modules used by OCD-flagged users — these directly incentivize compulsive daily checking.
- **Do not** implement repeated "Are you sure? / Confirm again?" double-confirmation patterns on the same action within a session — this mirrors compulsive re-checking. One clear confirmation is enough.
- Avoid designs where a child can re-submit the same question/action repeatedly to get renewed reassurance (e.g., re-running a "was that right?" check). If a confidence/status indicator exists, show it once per session rather than on-demand-refreshable.
- For any OCD-relevant module, prefer therapist-configured exposure/ERP flows over open-ended self-checking tools, consistent with IOCDF guidance that app-assisted ERP (structured, therapist-linked) outperforms unstructured reassurance tools.

---

## 7. WCAG 2.2 — Cognitive Accessibility (COGA)

**Finding:** WCAG 2.2 added several success criteria directly relevant to cognitive accessibility, and the COGA Task Force's supplemental "Making Content Usable" guidance goes further (non-normative but directly actionable). Relevant WCAG 2.2 criteria: **2.2.6 Timeouts** (warn users of session timeouts and their effects), **3.2.6 Consistent Help** (help mechanisms appear in the same relative place across pages), **3.3.7 Redundant Entry** (don't force re-entry of already-provided information), **3.3.8 Accessible Authentication** (no cognitive-function test — like memorized passwords — as the only login method).

**Source:** [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/), [W3C COGA — Making Content Usable for People with Cognitive and Learning Disabilities](https://w3c.github.io/coga/content-usable/), [W3C COGA Techniques](https://w3c.github.io/coga/techniques/index.html)

**UI implications:**
- Any session/exercise timeout must be preceded by a warning with an easy extend option (2.2.6).
- Put "Help" / "Get support" controls in the same location on every screen (3.2.6).
- Never ask a child to re-enter data (name, previously selected settings) already captured elsewhere in the flow (3.3.7).
- Avoid password-only login for child accounts; prefer parent-managed accounts, PIN + recognition-based login, or passwordless flows (3.3.8).
- From COGA supplemental guidance: keep one primary action per screen, use plain language (short sentences, common words), and provide icons paired with text labels rather than icon-only controls.

---

## 8. Designing for Children (NN/g)

**Finding:** Nielsen Norman Group's children's UX research (ages 3–12, 4th edition, ~156 findings) stresses that age bands matter far more for kids than adults — NN/g splits into young (3–5), mid (6–8), and older (9–12), because a two-year gap changes reading ability, motor control, and abstract-reasoning capacity substantially. Effective design leverages children's existing real-world mental models (skeuomorphic cues even 3-year-olds understand), gives explicit rather than subtle feedback (facial expressions/tone alone are missed by under-6s), and prevents errors instead of requiring recovery from them. "Not infantilizing" in practice means avoiding condescending copy/characters for the 9–12 band while keeping the 3–8 band more concretely guided.

**Source:** [NN/g — UX Design for Children (Ages 3-12), 4th Edition](https://www.nngroup.com/reports/children-on-the-web/), [NN/g — Designing for Kids: Cognitive Considerations](https://www.nngroup.com/articles/kids-cognition/)

**UI implications:**
- Segment UI complexity/copy tone by the app's actual target age band(s) rather than one generic "kid mode" — NeuroBridge should decide per-feature which band it's designed for and adjust vocabulary/interaction complexity accordingly.
- Feedback must be explicit and multi-modal (visual + text, not tone/expression alone) for younger users.
- Design error prevention (constrained inputs, confirm-before-destructive) over error recovery messaging.
- Avoid mouse/trackpad-specific or overly prescriptive interaction instructions; support the input method the child is actually using.

---

## 9. Gamification for Neurodivergent Children

**Finding:** Gamification (feedback, small rewards, adaptive challenge) has RCT-level evidence of improving attention and engagement in children with ADHD specifically. But the same literature flags real downside risk: badges/leaderboards/extrinsic-reward mechanics can crowd out intrinsic motivation, increase cognitive load ("gameful design" adds decision overhead), and — as noted in the OCD section above — some reward mechanics (streaks) actively harm a subset of users. The strongest recommendation across sources is **adaptive, personalized gamification** (difficulty/pacing/feedback frequency that adjusts per learner) rather than one fixed reward scheme for everyone.

**Source:** [Frontiers in Education — Gamified educational app, ADHD RCT (2025)](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1668260/full), [PMC — Gamification in Mobile Apps for Children With Disabilities: Scoping Review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11415723/)

**UI implications:**
- Make gamification elements (streaks, points, badges, leaderboards) individually toggleable per user/diagnosis profile — default streaks OFF for users flagged with OCD-relevant modules; default competitive/leaderboard elements OFF broadly for a therapeutic app.
- Prefer effort/completion-based feedback ("You finished 3 steps") over comparative or loss-framed feedback ("You beat 80% of users" / "Don't lose your streak").
- Keep reward frequency high but low-stakes (small, frequent, non-punishing) rather than big infrequent rewards tied to unbroken consistency.

---

## 10. Cognitive Load / Progressive Disclosure / Information Hierarchy

**Finding:** Cognitive Load Theory (Sweller, 1988) establishes that working memory is a hard, limited resource; progressive disclosure — showing only what's relevant to the current step and deferring the rest — is the standard mitigation. NN/g-cited research indicates progressive disclosure can cut task completion time 20–40% and improve comprehension by removing extraneous/competing information from view rather than requiring the user to filter it themselves.

**Source:** [Nielsen Norman Group — Progressive Disclosure (concept origin, Nielsen 1995)](https://www.nngroup.com/articles/progressive-disclosure/), [Cognitive Load Theory — Sweller 1988, summarized via Ballpark Research Glossary](https://ballparkhq.com/research-glossary/cognitive-load)

**UI implications:**
- One primary decision/action per screen; advanced/secondary options collapsed behind an explicit "More options" affordance, not shown by default.
- Break multi-field forms and multi-step exercises into sequential single-focus screens rather than long scrolling pages.
- Use contextual disclosure (show help/detail only when the user is at the relevant step) instead of front-loading all instructions before the task starts.

---

## Cross-Cutting Summary: What to Make Configurable vs. Fixed

| Configurable (individual variability is high — do not force one default) | Fixed baseline (evidence is consistent enough to bake in) |
|---|---|
| Font family (dyslexia fonts optional, never forced) | No auto-playing media anywhere |
| Letter/word spacing, line height, text size | Body text left-aligned, never justified |
| Animation/sound/haptics on-off | Session timeout warnings with extend option |
| Gamification elements (streaks, badges, leaderboards) — off by default for anxiety/OCD profiles | No countdown-timer visuals on therapeutic tasks |
| Notification frequency / quiet hours | Consistent navigation/help placement across all screens |
| Visual-math-aid toggle (on by default, dismissible once mastered) | Plain, literal language; icons paired with text labels |
| Reward framing (effort-based vs. milestone-based) | One primary action per screen; progressive disclosure for advanced options |
