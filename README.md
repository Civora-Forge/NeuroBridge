# NeuroBridge

**A support platform that adapts to how you feel right now, not just what you were diagnosed with.**

Most tools for neurodivergent support give every user the same static toolkit based on a fixed profile: ADHD → show ADHD features, done. NeuroBridge instead reads the user's current context — mood, cognitive load, activity, and what's worked before — and reconfigures the experience around that state. The same person gets a full dashboard on a good day and a single, minimal action on an overwhelming one.

NeuroBridge currently supports OCD, ADHD, dyslexia, dyscalculia, dyspraxia, ASD, anxiety, depression, and APD, built so the same intervention (e.g. task breakdown) can serve several of those domains at once, rather than living in one disorder-specific silo.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Team Ownership](#team-ownership)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Core Systems](#core-systems)
- [Agent Architecture](#agent-architecture)
- [Authentication & Roles](#authentication--roles)
- [Adaptive Onboarding](#adaptive-onboarding)
- [JITAI System](#jitai-system)
- [Design System](#design-system)
- [Development](#development)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Current Implementation](#current-implementation)
- [Roadmap](#roadmap)
- [Design Principles](#design-principles)

---

## How It Works

NeuroBridge runs as a closed feedback loop rather than a one-time onboarding survey:

1. **Context Engine** collects signals — conversation, explicit input, environment, activity — into a `ContextSnapshot`.
2. **Context Fusion** combines those signals, resolving conflicts and weighting confidence.
3. **User State Model** turns fused context into a live read of mood, cognitive load, energy, intent, and urgency.
4. **Cognitive Reasoning Core** interprets that state and produces an `AdaptationPlan`: which intervention to offer and how the interface should change.
5. **Adaptive Experience Layer** and **Support Modules** carry out the plan — reshaping the UI and delivering the actual support.
6. **Reflection Engine** checks whether it worked (accepted? completed? abandoned?).
7. **Memory System** stores what worked, so the next adaptation is better informed.

**Example:** the same user hits a 25-minute focus session that gets abandoned repeatedly. The Reflection Engine flags the pattern, Memory stores it, and future sessions default to 10 minutes — without the user ever opening a settings page.

This makes NeuroBridge **state-adaptive rather than diagnosis-adaptive**: a diagnosis sets the starting toolkit, but the current moment decides what actually gets shown.

---

## Team Ownership

The adaptive architecture is split across four engineering roles:

| Role | Owns | Answers |
|---|---|---|
| **Context & Perception** | Context Engine, mood/emotion inference, conversation analysis, context fusion | *What's happening with the user right now?* |
| **Adaptive Intelligence** | User State Model, Cognitive Reasoning Core, planner, intervention ranking | *What do they need, and how should we respond?* |
| **Adaptive Experience** | UI Adapter, dynamic layouts, accessibility modes, interaction adaptation | *How does that decision become the actual interface?* |
| **Support & Learning** | Support modules, reflection engine, memory system | *Did it work, and what should we remember?* |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | JavaScript (JSX) |
| UI Framework | React 18.3 |
| Build Tool | Vite 5.4 (SWC) |
| Styling | Tailwind CSS 3.4 + CSS custom properties |
| Components | shadcn/ui + Radix UI |
| Routing | react-router-dom 6.30 |
| Client State | React Context + localStorage |
| Server State | TanStack React Query 5.83 |
| Animation | Framer Motion 10.12 |
| Charts | Recharts 2.15 |
| Forms | react-hook-form + Zod |
| Backend | Flask |
| Auth & Database | Supabase |
| Testing | Vitest + jsdom + Testing Library |
| Icons | lucide-react |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Python 3+ (for the Flask backend)

### Installation

```bash
git clone https://github.com/Civora-Forge/NeuroBridge.git
cd NeuroBridge

npm install
cp .env.example .env
# edit .env with your Supabase credentials
```

### Running

**Frontend only**

```bash
npm run dev
```

Runs on `http://localhost:8080`.

**Full stack**

```powershell
# Windows
.\start-dev.ps1
```

```bash
# Linux / macOS
bash start-dev.sh
```

The Flask backend runs on port `5000`; Vite proxies `/api` requests to it.

### Build

```bash
npm run build
npm run build:dev
npm run preview
```

---

## Project Structure

```text
backend/adaptive/
├── state/          User State Model
└── reasoning/       Cognitive Reasoning Core, planner, intervention ranking

src/
├── adaptive/
│   ├── context/     conversation/mood/activity signals, context fusion, JITAI
│   ├── ui/          UI Adapter
│   ├── reflection/  outcome analysis
│   └── memory/      memory system
├── support/
│   ├── executive/   task breakdown, focus sessions
│   ├── emotional/   grounding, check-ins
│   ├── learning/    dyslexia, dyscalculia tools
│   ├── sensory/     regulation, low-stimulation modes
│   └── specialized/ OCD/ERP tools
├── components/      shared UI, adaptive components, per-domain widgets
├── pages/           adhd/ asd/ ocd/ dyslexia/ dyscalculia/ dyspraxia/ depression/ anxiety/ guardian/ support/
└── test/
```

The exact structure evolves as the adaptive architecture consolidates.

---

## Core Systems

**Context Engine** — collects conversational, environmental, and activity signals into an internal `UnifiedContext`, exposed downstream as a `ContextSnapshot`.

**Context Fusion** — merges multi-source signals, resolves conflicts, and estimates confidence before handing off to the state model.

**User State Model** — a live read of mood, cognitive load, energy, attention, intent, and urgency, updated throughout a session.

**Cognitive Reasoning Core** — interprets state into a plan: rank interventions, decide adaptation strategy, produce an `AdaptationPlan`.

**Adaptive Intervention System** — selects the single most relevant intervention (task breakdown, focus session, grounding, reading support, etc.) rather than surfacing everything at once.

**Adaptive Experience Layer** — turns the plan into UI changes: Normal, Focus, Minimal, Low-Stimulation, Overwhelm, Guided, Reading, and High-Contrast modes.

**Support Modules** — the actual interventions, grouped by capability: executive, emotional, learning, sensory, motor/coordination, and specialized (ERP, exposure hierarchy, social scenarios).

**Reflection Engine** — tracks whether an intervention was accepted, completed, or abandoned, and surfaces patterns (e.g. "10-minute sessions complete more often than 25-minute ones").

**Memory System** — stores preferences and outcomes locally-first, with optional Supabase sync; user-controlled, transparent, and deletable.

---

## Agent Architecture

Agents aren't a separate layer — they're embedded wherever a decision genuinely needs reasoning rather than a fixed rule:

- **Perception agents** (conversation analysis, mood inference) live in the Context & Perception layer.
- **Decision agents** (planning, intervention ranking) live in the Adaptive Intelligence layer.
- **Support-specific agents** (task breakdown, reading adaptation) live inside individual modules where they add real value.

Deterministic functionality — timers, text-to-speech, font scaling, reduced motion — stays as plain code. The rule: **use an agent where reasoning is required, use deterministic logic where it's sufficient.**

---

## Authentication & Roles

| Role | Capabilities |
|---|---|
| **User** | Personal support modules, onboarding, adaptive assistance, settings |
| **Guardian** | Linked user activity, alerts, task assignment, care-circle coordination |
| **Support** | Oversight and monitoring of linked users |

Supports Supabase authentication and a mock-auth mode for local development. Route access is enforced by role and feature flag.

---

## Adaptive Onboarding

```text
Challenge Selection → Questionnaire → Tag Scoring → Module Selection → Initial Profile
```

Onboarding is only the starting point — the profile it produces is continuously refined by context, activity, conversation, and intervention outcomes rather than staying fixed after setup.

---

## JITAI System

A prototype Just-In-Time Adaptive Intervention service that decides when an intervention is worth surfacing, based on simulated HRV, EDA, and IMU signals feeding rule-based triggers (sensory overload, grounding, motor rest). Signals are simulated for demonstration today; the architecture is built to accept real wearable/mobile sensor input later. JITAI is part of the broader Adaptive Intervention System, not a separate architecture.

---

## Design System

- **Typography** — Plus Jakarta Sans (headings), DM Sans (body)
- **Styling** — Tailwind CSS + CSS custom properties, light and dark modes
- **Components** — shadcn/ui, Radix UI primitives, lucide-react icons
- **Adaptive modes** — Normal, Focus, Minimal, Low-Stimulation, Overwhelm, Guided, Reading, High-Contrast

---

## Development

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run build:dev` | Development build |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest |
| `npm run test:watch` | Run Vitest in watch mode |

**Key patterns:** local-first persistence with optional backend sync, progressive personalization past onboarding, context-aware adaptation from multiple signals, a feature registry for dynamic enablement, role-based access, and graceful degradation when optional backend services are unavailable.

---

## Testing

```bash
npm run test
npm run test:watch
```

Built on Vitest, jsdom, and Testing Library. Coverage priorities: context engine, context fusion, user state model, reasoning core, intervention ranking, adaptive UI, support modules, reflection, and memory — with particular attention to adaptive decisions under different user states.

---

## Environment Variables

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Mock authentication is available where Supabase credentials aren't configured.

---

## Current Implementation

**Shipped:** authentication, role-based access, protected routes, adaptive onboarding with tag-based scoring, feature registry, disorder-domain support modules, guardian/support dashboards, care-circle sync, JITAI prototype, local-first persistence with Supabase sync, accessibility-oriented design system, initial outcome tracking.

**In progress:** conversation-based context extraction, mood/emotion inference, context fusion, the unified user state model, the cognitive reasoning core, intervention ranking, dynamic UI adaptation, reflection-driven personalization, long-term adaptive memory.

---

## Roadmap

- [x] **Phase 1 — Foundation:** auth, roles, onboarding, feature registry, core support modules, local-first persistence
- [x] **Phase 2 — Context & Perception:** conversation extraction, mood inference, activity/environment tracking, context fusion
- [x] **Phase 3 — Adaptive Intelligence:** unified state model, reasoning core, planner, intervention ranking
- [x] **Phase 4 — Adaptive Experience:** UI adapter, dynamic complexity, state-based modes, adaptive navigation/typography
- [x] **Phase 5 — Reflection & Memory:** outcome tracking, reflection engine, long-term memory, feedback-driven adaptation
- [ ] **Phase 6 — Intelligent Support:** support-specific agents, advanced JITAI, real sensor integration, cross-domain personalization
- [ ] **Phase 7 — Production:** automated testing, accessibility audit, WCAG compliance, security review, mobile app, multilingual support

---

## Design Principles

1. **Adapt to the person, not just the diagnosis** — a diagnosis doesn't fully describe what someone needs right now.
2. **Context before intervention** — understand the situation before deciding how to respond.
3. **Minimal effective intervention** — offer the smallest useful thing, not every available option.
4. **Continuous personalization** — keep learning after onboarding, not just during it.
5. **Explainable adaptation** — users should understand why their experience is changing.
6. **Privacy by design** — collect and retain only what personalization actually needs.
7. **Human-centered support** — NeuroBridge assists; it doesn't replace diagnosis, clinical judgment, or emergency care.
