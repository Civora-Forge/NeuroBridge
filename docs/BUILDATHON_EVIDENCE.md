# NeuroBridge: Buildathon Evidence

## Product

NeuroBridge is an AI-assisted, state-adaptive support MVP for neurodivergent users. It adapts support tools from current context and recorded outcomes rather than presenting only diagnosis-based dashboards. It is not a diagnostic, medical, or clinically validated product.

## Verified implementation

- React/Vite frontend and FastAPI backend: `src/`, `backend/main.py`.
- Supabase Auth, storage, and data access, with browser-local fallback in some flows: `src/lib/supabaseClient.js`, `src/stores/gardenStore.js`.
- Server-side Gemini agent/tool orchestration and authenticated Gemini proxy: `backend/services/agent_service.py`, `backend/routers/ai_proxy_router.py`.
- Gemini requests require explicit opt-in; common direct identifiers in text are redacted before proxy requests: `src/pages/user/UserSettings.jsx`, `backend/auth.py`, `backend/routers/ai_proxy_router.py`.
- Working MVP interventions include task breakdown, focus session, grounding, gentle activity, social connection, cognitive reframing, and evidence journal: `docs/role4/module-audit.md`.

## Market and business evidence

- Target users: neurodivergent individuals; guardian and support roles are prototype interfaces.
- Differentiation: cross-domain, state-adaptive support rather than a fixed diagnosis-specific toolkit.
- Users, pilots, partnerships, revenue, retention, pricing, willingness to pay, clinical efficacy, and real-world personalization impact: **UNKNOWN**. Do not claim them without independently verifiable evidence.
- Competitor analysis: **UNKNOWN** in this repository.
- Business model/buyer: **UNKNOWN**. A defensible next validation step is structured interviews with users, caregivers, and support providers before choosing a consumer, institution, or hybrid model.

## Founder evidence

Founder identities, relevant experience, time commitment, and ownership allocation: **UNKNOWN** in this repository. The README documents engineering-role ownership, not founder credentials (`README.md`).

## Demo-safe positioning

Demonstrate onboarding, recommended tools, task breakdown/focus completion, and outcome feedback. Describe Gemini as an opt-in assistance layer with confirmation-gated writes. Do not represent the support dashboard as live monitoring; it intentionally shows no recipient data until consented linking and authorization are implemented.
