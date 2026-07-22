# NeuroBridge

**Neuro-inclusive, context-aware adaptive support platform**

NeuroBridge is a neuro-inclusive health-assistance web application designed to provide personalized, accessible, and context-aware support for neurodivergent individuals.

Rather than treating every user as a fixed profile or providing static disorder-specific toolkits, NeuroBridge aims to continuously adapt its support based on the user's **current context, emotional state, activity, cognitive load, preferences, and previous intervention outcomes**.

The system follows a continuous adaptive loop:

```text
Perceive
   ↓
Understand
   ↓
Reason
   ↓
Adapt
   ↓
Support
   ↓
Reflect
   ↓
Remember
   ↓
Adapt Again
```

NeuroBridge currently provides support across domains including OCD, ADHD, Dyslexia, Dyscalculia, Dyspraxia, ASD, Anxiety, Depression, and APD, while its architecture is designed around **individual needs and current state rather than diagnosis alone**.

---

## Table of Contents

* [Architecture](#architecture)
* [Adaptive Architecture](#adaptive-architecture)
* [Team Ownership](#team-ownership)
* [Tech Stack](#tech-stack)
* [Getting Started](#getting-started)
* [Project Structure](#project-structure)
* [Core Systems](#core-systems)

  * [Context Engine](#1-context-engine)
  * [Context Fusion](#2-context-fusion)
  * [User State Model](#3-user-state-model)
  * [Cognitive Reasoning Core](#4-cognitive-reasoning-core)
  * [Adaptive Intervention System](#5-adaptive-intervention-system)
  * [Adaptive Experience Layer](#6-adaptive-experience-layer)
  * [Support Modules](#7-support-modules)
  * [Reflection Engine](#8-reflection-engine)
  * [Memory System](#9-memory-system)
* [Agent Architecture](#agent-architecture)
* [Authentication & Roles](#authentication--roles)
* [Adaptive Onboarding](#adaptive-onboarding)
* [JITAI System](#jitai-system)
* [Support Domains](#support-domains)
* [Design System](#design-system)
* [Development](#development)
* [Testing](#testing)
* [Environment Variables](#environment-variables)
* [Current Implementation](#current-implementation)
* [Roadmap](#roadmap)

---

# Architecture

NeuroBridge is structured as a closed-loop adaptive system.

```text
                              USER
                                │
                                ▼
                   ┌────────────────────────┐
                   │    CONTEXT ENGINE      │
                   │                        │
                   │ Conversation            │
                   │ Emotion & Mood          │
                   │ Environment             │
                   │ User Activity            │
                   │ Explicit User Input     │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │    CONTEXT FUSION       │
                   │                        │
                   │ Signal Combination      │
                   │ Confidence Estimation  │
                   │ Conflict Resolution     │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │    USER STATE MODEL     │
                   │                        │
                   │ Mood                   │
                   │ Cognitive Load         │
                   │ Energy                 │
                   │ Intent                 │
                   │ Urgency                │
                   │ Activity               │
                   │ Relevant Context       │
                   └────────────┬───────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │ COGNITIVE REASONING     │
                   │        CORE             │
                   │                        │
                   │ State Interpretation    │
                   │ Planning               │
                   │ Intervention Ranking   │
                   │ Adaptation Decisions    │
                   └────────────┬───────────┘
                                │
                         Adaptation Plan
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
          ┌───────────────────┐   ┌────────────────────┐
          │ ADAPTIVE          │   │ SUPPORT MODULES    │
          │ EXPERIENCE        │   │                    │
          │                   │   │ Executive Support │
          │ UI Adapter        │   │ Emotional Support │
          │ Dynamic UI        │   │ Learning Support  │
          │ Accessibility     │   │ Sensory Support   │
          │ Interaction       │   │ Specialized Tools │
          └─────────┬─────────┘   └──────────┬─────────┘
                    │                        │
                    └────────────┬───────────┘
                                 ▼
                         USER INTERACTION
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    REFLECTION ENGINE   │
                    │                        │
                    │ Intervention Outcome   │
                    │ Engagement             │
                    │ Completion             │
                    │ Behavioral Patterns    │
                    │ Adaptation Effectiveness│
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │     MEMORY SYSTEM      │
                    │                        │
                    │ User Preferences       │
                    │ Successful Strategies  │
                    │ Failed Strategies      │
                    │ Long-term Patterns     │
                    └────────────┬───────────┘
                                 │
                                 └──────────────►
                                  FUTURE ADAPTATION
```

## Data Flow

1. **Context Engine** collects signals from user conversations, explicit inputs, environment, and activity.
2. **Context Fusion** combines heterogeneous signals into a unified contextual representation.
3. **User State Model** estimates the user's current state, including emotional state, cognitive load, energy, intent, and urgency.
4. **Cognitive Reasoning Core** interprets the current state and determines the most appropriate strategy.
5. **Adaptive Intervention System** selects and ranks interventions based on relevance and context.
6. **Adaptive Experience Layer** modifies the interface and interaction model to match the user's current needs.
7. **Support Modules** execute the selected interventions and provide specialized assistance.
8. **Reflection Engine** evaluates whether the intervention was effective.
9. **Memory System** stores useful outcomes and preferences.
10. Stored knowledge informs future adaptation, allowing NeuroBridge to become increasingly personalized over time.

---

# Adaptive Architecture

The core differentiator of NeuroBridge is its adaptive layer.

The system does not rely exclusively on a static onboarding profile such as:

```text
User → ADHD → Show ADHD Features
```

Instead, it aims to follow:

```text
User Profile
      +
Current Context
      +
Conversation
      +
Activity
      +
Emotional State
      +
Historical Outcomes
      ↓
Current User State
      ↓
Adaptive Decision
      ↓
Personalized Intervention
      ↓
Outcome
      ↓
Memory
      ↓
Future Adaptation
```

This allows the same user to receive different support depending on their current situation.

For example:

```text
Same User

Normal State
    ↓
Full Dashboard
Multiple Options
Standard Focus Session

Overwhelmed State
    ↓
Minimal UI
Reduced Choices
Task Breakdown

High Cognitive Load
    ↓
Simplified Instructions
Shorter Tasks
Step-by-Step Guidance

Successful Intervention
    ↓
Reflection
    ↓
Memory
    ↓
Future recommendations become more personalized
```

The goal is to make NeuroBridge **state-adaptive**, rather than simply **diagnosis-adaptive**.

---

# Team Ownership

The adaptive architecture is divided into four primary engineering responsibilities.

## 1. Context & Perception Engineer

**Ownership:**

```text
Context Engine
Mood / Emotion Inference
Conversation Analysis
Environment
User Activity
Context Fusion
```

Primary responsibility:

> Understand what is happening with the user.

Responsibilities include:

* Processing conversational signals
* Inferring emotional and mood-related signals
* Tracking user activity
* Processing environmental context
* Combining multiple signals
* Producing a structured `ContextSnapshot`

---

## 2. Adaptive Intelligence Engineer

**Ownership:**

```text
User State Model
Cognitive Reasoning Core
Planner
Intervention Ranking
Adaptation Decision Engine
```

Primary responsibility:

> Determine what the user may need and how NeuroBridge should respond.

Responsibilities include:

* Building the current user state
* Interpreting contextual signals
* Generating plans
* Ranking possible interventions
* Selecting adaptation strategies
* Producing an `AdaptationPlan`

This is the central decision-making layer of NeuroBridge.

---

## 3. Adaptive Experience Engineer

**Ownership:**

```text
UI Adapter
Adaptive Frontend
Accessibility
Dynamic UI
Interaction Adaptation
```

Primary responsibility:

> Translate adaptation decisions into the actual user experience.

Responsibilities include:

* Dynamic interface layouts
* UI complexity adaptation
* Navigation adaptation
* Typography adaptation
* Reduced-motion modes
* Focus modes
* Low-stimulation modes
* Accessibility configurations

---

## 4. Support & Learning Engineer

**Ownership:**

```text
Support Modules
Reflection Engine
Memory System
Support-specific Agents
```

Primary responsibility:

> Deliver interventions, evaluate outcomes, and preserve useful knowledge for future adaptation.

Responsibilities include:

* Implementing support modules
* Tracking intervention outcomes
* Reflection and feedback
* User memory
* Long-term personalization
* Support-specific intelligent tools

---

# Tech Stack

| Layer                     | Technology                               |
| ------------------------- | ---------------------------------------- |
| Language                  | JavaScript (JSX)                         |
| UI Framework              | React 18.3                               |
| Build Tool                | Vite 5.4 (SWC)                           |
| Styling                   | Tailwind CSS 3.4 + CSS Custom Properties |
| Component Library         | shadcn/ui + Radix UI                     |
| Routing                   | react-router-dom 6.30                    |
| Client State              | React Context + localStorage             |
| Server State              | TanStack React Query 5.83                |
| Animations                | Framer Motion 10.12                      |
| Charts                    | Recharts 2.15                            |
| Forms                     | react-hook-form + Zod                    |
| Backend                   | Flask                                    |
| Authentication & Database | Supabase                                 |
| Testing                   | Vitest + jsdom + Testing Library         |
| Icons                     | lucide-react                             |

---

# Getting Started

## Prerequisites

* Node.js 18+
* npm
* Python 3+
* Flask for the backend API

## Installation

```bash
# Clone the repository
git clone https://github.com/Civora_Forge/neurobridge.git

cd neurobridge

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Edit .env with your Supabase credentials
```

## Running

### Frontend only

```bash
npm run dev
```

The Vite development server runs on port `8080`.

### Full stack

Windows:

```powershell
.\start-dev.ps1
```

Linux / macOS:

```bash
bash start-dev.sh
```

The Flask backend runs on port `5000`.

## Build

```bash
npm run build
npm run build:dev
npm run preview
```

---

# Project Structure

The project is gradually being organized around the adaptive architecture.

```text
src/
│
├── adaptive/
│   │
│   ├── context/
│   │   ├── conversationAgent.js
│   │   ├── moodAgent.js
│   │   ├── environmentContext.js
│   │   ├── activityTracker.js
│   │   ├── contextFusion.js
│   │   └── jitaiService.js
│   │
│   ├── state/
│   │   ├── userStateModel.js
│   │   └── useAdaptiveBehavioralEngine.js
│   │
│   ├── reasoning/
│   │   ├── cognitiveReasoning.js
│   │   ├── planner.js
│   │   ├── interventionRanking.js
│   │   ├── adaptationPolicy.js
│   │   ├── disorderFeatureRegistry.js
│   │   ├── moduleSelector.js
│   │   └── questionEngine.js
│   │
│   ├── ui/
│   │   └── uiAdapter.js
│   │
│   ├── reflection/
│   │   ├── reflectionEngine.js
│   │   └── outcomeAnalysis.js
│   │
│   └── memory/
│       └── memorySystem.js
│
├── support/
│   │
│   ├── executive/
│   │
│   ├── emotional/
│   │
│   ├── learning/
│   │   ├── dyscalculiaAdaptiveEngine.js
│   │   ├── phonologicalAnalysis.js
│   │   ├── pronunciationAnalysis.js
│   │   ├── readingMetrics.js
│   │   ├── struggleDetection.js
│   │   └── PhonemeWeaknessDetector.jsx
│   │
│   ├── sensory/
│   │
│   ├── specialized/
│   │   └── ocdStore.js
│   │
│   ├── api/
│   │   ├── moduleApi.js
│   │   ├── dyslexiaApi.js
│   │   ├── asdSupportApi.js
│   │   └── patternMatchingAlerts.js
│   │
│   └── stores/
│       ├── careSyncStore.js
│       └── wardTaskStore.js
│
├── context/
│   └── AuthContext.jsx
│
├── lib/
│   ├── disorders.js
│   ├── featureRegistry.js
│   ├── supabaseClient.js
│   └── utils.js
│
├── hooks/
│   ├── useDyslexiaRealtimeAnalytics.js
│   ├── usePhonologicalAnalysis.js
│   ├── useVoiceRecording.js
│   ├── use-mobile.jsx
│   └── use-toast.js
│
├── data/
│   ├── modulesRegistry.js
│   └── questionsRegistry.js
│
├── components/
│   ├── ui/
│   ├── adaptive/
│   ├── anxiety/
│   ├── Dyspraxia/
│   ├── ocd/
│   ├── asd/
│   ├── AppLayout.jsx
│   ├── FeatureGate.jsx
│   ├── OnboardingFlow.jsx
│   ├── ProtectedRoute.jsx
│   └── Questionnaire.jsx
│
├── pages/
│   ├── Home.jsx
│   ├── Login.jsx
│   ├── ToolWorkspace.jsx
│   ├── adhd/
│   ├── asd/
│   ├── ocd/
│   ├── dyslexia/
│   ├── dyscalculia/
│   ├── dyspraxia/
│   ├── depression/
│   ├── anxiety/
│   ├── guardian/
│   ├── support/
│   ├── user/
│   └── admin/
│
└── test/
    ├── setup.js
    └── example.test.js
```

The exact directory structure may evolve as the adaptive architecture is implemented and integrated into the existing codebase.

---

# Core Systems

## 1. Context Engine

The Context Engine is responsible for collecting signals that describe the user's current situation.

### Context Sources

```text
Conversation
Explicit User Input
Environment
Time
User Activity
Task State
Optional Physiological Signals
```

The system may derive signals such as:

* Emotional cues
* Mood indicators
* Cognitive load
* Task switching
* Activity level
* Current task
* Time constraints
* Session behavior

The Context Engine produces structured context rather than directly deciding what intervention to provide.

Example:

```json
{
  "emotion": {
    "label": "overwhelmed",
    "confidence": 0.86
  },
  "activity": {
    "task_switching": "high"
  },
  "environment": {
    "time_of_day": "night"
  },
  "task": {
    "urgency": "high"
  }
}
```

---

## 2. Context Fusion

Context Fusion combines multiple sources of information into a unified representation.

```text
Conversation
      +
Activity
      +
Environment
      +
Explicit Input
      +
Optional Sensors
      ↓
Context Fusion
      ↓
Unified Context
```

The fusion layer is responsible for:

* Combining signals
* Handling conflicting signals
* Estimating confidence
* Avoiding over-reliance on a single signal
* Preparing input for the User State Model

---

## 3. User State Model

The User State Model represents the user's current inferred state.

Potential state dimensions include:

```text
Mood
Emotional State
Cognitive Load
Energy
Attention
Intent
Urgency
Task Complexity
Engagement
```

Example:

```json
{
  "mood": "overwhelmed",
  "cognitive_load": "high",
  "energy": "low",
  "attention": "fragmented",
  "intent": "complete_task",
  "urgency": "high"
}
```

The User State Model is dynamic and can change throughout a session.

---

## 4. Cognitive Reasoning Core

The Cognitive Reasoning Core determines how NeuroBridge should respond to the current user state.

It includes:

* State interpretation
* Planning
* Intervention ranking
* Adaptation decisions
* Personalization logic

Example:

```text
Current State
    ↓
High cognitive load
    +
High urgency
    +
User reports overwhelm
    ↓
Reasoning
    ↓
Break complex task into smaller steps
    ↓
Rank Task Breakdown as primary intervention
    ↓
Reduce UI complexity
    ↓
Generate Adaptation Plan
```

The reasoning system may combine deterministic rules, scoring models, and intelligent agents depending on the use case.

---

## 5. Adaptive Intervention System

The Adaptive Intervention System determines which support should be provided and when.

Interventions may include:

* Task breakdown
* Focus sessions
* Grounding
* Sensory regulation
* Reading assistance
* Routine support
* Guided exercises
* Cognitive reframing
* Specialized disorder-domain tools

Interventions are ranked based on:

* Current user state
* User preferences
* Context
* Historical effectiveness
* Current task
* Intervention confidence

The system should prioritize the **most relevant intervention** rather than overwhelming the user with every available feature.

---

## 6. Adaptive Experience Layer

The Adaptive Experience Layer transforms the Adaptation Plan into the actual interface.

Potential adaptations include:

```text
Normal Mode
Focus Mode
Minimal Mode
Low-Stimulation Mode
Overwhelm Mode
Guided Mode
Reading Mode
High-Contrast Mode
```

Adaptation may affect:

* Number of visible options
* Navigation complexity
* Typography
* Information density
* Animation
* Color intensity
* Interaction patterns
* Guidance level
* Module visibility

Example:

```text
User State:
High Cognitive Load

        ↓

UI Adaptation:

- Reduce visible modules
- Show one primary action
- Simplify navigation
- Reduce animations
- Increase instruction clarity
```

The adaptive UI should respond to the user's **current needs**, not only their diagnosis.

---

## 7. Support Modules

Support modules provide the actual assistance delivered to users.

Modules are organized primarily by support capability.

### Executive Support

* Task Breakdown
* Focus Sessions
* Visual Timeline
* Routine Planning
* Body Doubling

### Emotional Support

* Emotional Check-in
* Grounding
* Cognitive Reframing
* Calm Mode
* Panic Support

### Learning Support

* Adaptive Reading
* Phonological Training
* Pronunciation Analysis
* Writing Assistance
* Visual Mathematics

### Sensory Support

* Sensory Regulation
* Low-Stimulation Modes
* Environmental Support

### Motor and Coordination Support

* Task Decomposition
* Motor Exercises
* Spatial Awareness
* Haptic Pacing
* Safe Route Planning

### Specialized Support

* ERP Tracking
* Exposure Hierarchy
* Social Story Builder
* Disorder-specific learning tools

Support modules are dynamically selected and configured based on the user's profile, context, state, and previous outcomes.

---

## 8. Reflection Engine

The Reflection Engine evaluates the effectiveness of interventions.

It may track:

```text
Was the intervention accepted?
Was it completed?
Was it abandoned?
Did the user engage?
Did the user report improvement?
Did the user's task progress change?
```

It can identify patterns such as:

```text
25-minute focus sessions
    ↓
Frequently abandoned

10-minute focus sessions
    ↓
Frequently completed

        ↓

Future Recommendation
10-minute focus sessions
```

The Reflection Engine provides feedback to the Memory System and future adaptation decisions.

---

## 9. Memory System

The Memory System stores useful information that can improve future personalization.

Potential memory categories include:

```text
User Preferences
Successful Interventions
Unsuccessful Interventions
Preferred Session Length
Accessibility Preferences
Interaction Patterns
Long-term Behavioral Patterns
```

Memory should be:

* User-controlled
* Transparent
* Privacy-aware
* Deletable
* Minimally collected

Current persistence uses a local-first approach with optional Supabase synchronization.

---

# Agent Architecture

Agents are not treated as a separate architectural layer.

Instead, agents are embedded within the systems where intelligent reasoning is required.

## Perception Agents

Owned primarily by the **Context & Perception layer**.

Examples:

```text
Conversation Analysis Agent
Mood / Emotion Inference Agent
Intent Detection Agent
```

Their responsibility is:

> Understand what is happening with the user.

Example:

```text
User:
"I have so much work and I can't think straight."

        ↓

Conversation Analysis

        ↓

Emotion:
Potentially overwhelmed

Intent:
Needs task assistance

Urgency:
High
```

---

## Decision Agents

Owned primarily by the **Adaptive Intelligence layer**.

Examples:

```text
Planning Agent
Intervention Ranking Agent
Adaptation Decision Agent
```

Their responsibility is:

> Determine what NeuroBridge should do next.

Example:

```text
User State
    ↓
Planning Agent
    ↓
Break task into smaller steps

Intervention Ranking
    ↓
1. Task Breakdown
2. Short Focus Session
3. Grounding
```

---

## Support-specific Agents

Support-specific agents may be implemented within individual modules where intelligent behavior provides meaningful value.

Examples:

```text
Task Breakdown Agent
Reading Adaptation Agent
Routine Planning Agent
```

Not every feature requires an agent.

Deterministic functionality such as:

```text
Timer
Text-to-Speech
Font Resizing
Reduced Motion
```

should remain conventional software components.

The architecture follows the principle:

> **Use agents where reasoning is required. Use deterministic systems where deterministic behavior is sufficient.**

---

# Authentication & Roles

NeuroBridge provides three primary user roles.

| Role         | Capabilities                                                            |
| ------------ | ----------------------------------------------------------------------- |
| **User**     | Personal support modules, onboarding, adaptive assistance, settings     |
| **Guardian** | Linked user activity, alerts, task assignment, care-circle coordination |
| **Support**  | Support oversight and linked-user monitoring                            |

Authentication supports:

* Supabase authentication
* Mock authentication for development

Route protection is handled through role and feature-level access control.

---

# Adaptive Onboarding

Onboarding establishes the initial personalization baseline.

The current onboarding flow includes:

```text
Challenge Selection
        ↓
Questionnaire
        ↓
Tag Scoring
        ↓
Module Selection
        ↓
Initial Profile
```

The system uses:

* `questionsRegistry.js`
* Tag-based scoring
* Module matching
* Profile persistence

The onboarding system is intentionally only the **starting point** of personalization.

Future adaptation should continuously refine the initial profile using:

```text
Initial Profile
      +
Context
      +
Activity
      +
Conversation
      +
Intervention Outcomes
      +
Memory
```

This creates progressive personalization rather than a static onboarding-only profile.

---

# JITAI System

NeuroBridge includes a prototype Just-In-Time Adaptive Intervention (JITAI) service.

The JITAI system is intended to determine when an intervention may be relevant based on the user's current context.

The current prototype includes:

* Simulated HRV signals
* Simulated EDA signals
* Simulated IMU data
* Rule-based trigger detection
* Sensory overload triggers
* Grounding intervention triggers
* Motor rest recommendations

The current physiological signals are simulated for prototyping and demonstration.

Future versions may support real sensor integration through compatible wearable or mobile-device APIs.

JITAI functionality is considered part of the broader **Adaptive Intervention System**, rather than an independent adaptive architecture.

---

# Support Domains

NeuroBridge provides support across multiple neurodivergence and mental well-being domains.

Current and planned domains include:

* OCD
* ADHD
* Dyslexia
* Dyscalculia
* Dyspraxia
* ASD
* Anxiety
* Depression
* APD

These domains are used to inform available support capabilities, but the adaptive architecture is not restricted to fixed diagnostic categories.

The same intervention may be useful across multiple domains depending on the user's current needs.

For example:

```text
Task Breakdown
    ├── ADHD
    ├── ASD
    ├── Anxiety
    └── General Cognitive Overload
```

This allows NeuroBridge to adapt based on **functional needs and current state**, rather than relying exclusively on diagnostic labels.

---

# Design System

The application uses a consistent accessibility-oriented design system.

## Typography

* Plus Jakarta Sans for headings
* DM Sans for body text

## Styling

* Tailwind CSS
* CSS custom properties
* Light and dark modes
* Accessible interaction patterns

## UI Components

Built using:

* shadcn/ui
* Radix UI primitives
* lucide-react icons

## Adaptive UI Modes

The adaptive experience layer may support modes such as:

```text
Normal
Focus
Minimal
Low-Stimulation
Overwhelm
Guided
Reading
High-Contrast
```

The goal is to adapt the interface according to the user's current state and accessibility needs.

---

# Development

## Available Scripts

| Command              | Description                   |
| -------------------- | ----------------------------- |
| `npm run dev`        | Start Vite development server |
| `npm run build`      | Production build              |
| `npm run build:dev`  | Development build             |
| `npm run preview`    | Preview production build      |
| `npm run lint`       | Run ESLint                    |
| `npm run test`       | Run Vitest                    |
| `npm run test:watch` | Run Vitest in watch mode      |

## API Proxy

Vite proxies `/api` requests to:

```text
http://localhost:5000
```

The backend is implemented using Flask.

## Key Engineering Patterns

### Local-first persistence

Application state is stored locally first, with optional backend synchronization.

### Progressive personalization

Initial onboarding creates a baseline profile that is refined through ongoing interaction and reflection.

### Context-aware adaptation

User state is derived from multiple contextual signals rather than a single input.

### Feature registry

Features can be dynamically enabled based on user profile and support requirements.

### Role-based access

Different user roles receive different capabilities.

### Graceful degradation

The application should continue to provide core functionality when optional backend services are unavailable.

---

# Testing

Testing is implemented using:

* Vitest
* jsdom
* Testing Library

Run tests:

```bash
npm run test
```

Run in watch mode:

```bash
npm run test:watch
```

The long-term testing strategy should cover:

```text
Context Engine
Context Fusion
User State Model
Reasoning Core
Intervention Ranking
Adaptive UI
Support Modules
Reflection
Memory
```

Particular attention should be given to testing adaptive decisions under different user states.

---

# Environment Variables

Create a `.env` file based on `.env.example`.

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

If Supabase credentials are unavailable, development environments may use mock authentication where supported.

---

# Current Implementation

The repository currently contains a mixture of implemented systems, prototypes, and components that are being integrated into the broader adaptive architecture.

## Currently Available

* Authentication
* Role-based access
* Protected routes
* Adaptive onboarding
* Tag-based initial personalization
* Feature registry
* Disorder-domain support modules
* Guardian and Support dashboards
* Care-circle synchronization
* JITAI prototype
* Local-first persistence
* Supabase integration
* Accessibility-oriented design system
* Initial outcome and personalization logic

## Adaptive Architecture Under Development

* Conversation-based context extraction
* Mood and emotion inference
* Context fusion
* Unified user state model
* Cognitive reasoning core
* Planning system
* Intervention ranking
* Adaptive intervention policy
* Dynamic UI adaptation
* Reflection-driven personalization
* Long-term adaptive memory
* Agentic reasoning components

The long-term objective is to unify these systems into a single closed-loop adaptive architecture.

---

# Roadmap

## Phase 1 — Foundation

* [x] Authentication
* [x] Role-based access
* [x] Adaptive onboarding
* [x] Feature registry
* [x] Core support modules
* [x] Local-first persistence
* [x] Initial accessibility system

## Phase 2 — Context & Perception

* [ ] Conversation context extraction
* [ ] Mood and emotion inference
* [ ] User activity tracking
* [ ] Environment context
* [ ] Context fusion
* [ ] Confidence-aware signal processing

## Phase 3 — Adaptive Intelligence

* [ ] Unified User State Model
* [ ] Cognitive Reasoning Core
* [ ] Planning system
* [ ] Intervention ranking
* [ ] Adaptation policy
* [ ] Agent-based decision support

## Phase 4 — Adaptive Experience

* [ ] UI Adapter
* [ ] Dynamic interface complexity
* [ ] State-based UI modes
* [ ] Adaptive navigation
* [ ] Adaptive typography
* [ ] Reduced-stimulation experiences
* [ ] Accessibility personalization

## Phase 5 — Reflection & Memory

* [ ] Intervention outcome tracking
* [ ] Reflection engine
* [ ] Strategy effectiveness analysis
* [ ] Long-term memory
* [ ] Personalized intervention history
* [ ] Feedback-driven adaptation

## Phase 6 — Intelligent Support

* [ ] Support-specific intelligent agents
* [ ] Advanced JITAI integration
* [ ] Real physiological sensor integration
* [ ] Cross-domain support personalization
* [ ] Improved multimodal context understanding

## Phase 7 — Production

* [ ] Comprehensive automated testing
* [ ] Accessibility audit
* [ ] WCAG compliance
* [ ] Backend consolidation
* [ ] Production deployment pipeline
* [ ] Privacy and security review
* [ ] Mobile application
* [ ] Multilingual support

---

# Design Principles

NeuroBridge is built around the following principles:

### 1. Adapt to the person, not just the diagnosis

A diagnosis does not fully describe what a user needs at a particular moment.

### 2. Context before intervention

The system should understand the situation before deciding how to respond.

### 3. Minimal effective intervention

The system should provide the smallest useful intervention rather than overwhelming users with options.

### 4. Continuous personalization

Personalization should evolve through interaction and outcomes rather than ending after onboarding.

### 5. Explainable adaptation

Users should be able to understand why the system is changing their experience.

### 6. Privacy by design

Only information necessary for personalization should be collected and retained.

### 7. Human-centered support

NeuroBridge is intended as a support and assistance platform, not a replacement for professional diagnosis, clinical judgment, or emergency care.
