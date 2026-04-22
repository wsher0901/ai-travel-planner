# Roam — AI Travel Planner

AI-powered travel planner. Differentiator: asks **"when are you free?"** (not "where do you want to go?") and recommends destinations by weather, cost, crowds, activity fit.

## Stack
- **Frontend:** Next.js 15 App Router, React, TypeScript, Tailwind, shadcn/ui (New York, Zinc), Zustand, Framer Motion, recharts, lucide-react — port 3000
- **Backend:** FastAPI, Python 3.11 (conda env `roam`), Pydantic, httpx — port 8000
- **DB/Auth:** Supabase (PostgreSQL + Google/GitHub/magic-link)
- **AI:** Groq `llama-3.3-70b-versatile` (dev) → Claude Sonnet (Phase 3). All calls through `backend/app/services/ai_provider.py` — never call providers from routers.
- **Maps:** Google Maps Platform (Maps JS, Places, Directions) · **Weather:** Open-Meteo

## Architecture
REST between frontend↔backend. Supabase is source of truth for auth + DB (frontend reads directly, backend writes). Zustand is single source of truth for plan state. All visual panels render from one structured JSON plan. Log every user action to `preference_signals` (Phase 5 data moat). Rate-limit public endpoints.

## Conventions
- React: PascalCase (`ChatInterface.tsx`) · Python: snake_case (`ai_provider.py`)
- Frontend: `frontend/src/{app,components,store,lib}/` — **`store` singular**
- Components: `frontend/src/components/{chat,layout,dock/panels,ui}/`
- Backend: `backend/app/{routers,services,models,prompts}/`
- No `localStorage`/`sessionStorage` — Zustand only
- API calls through `frontend/src/lib/api.ts`; Supabase client in `frontend/src/lib/supabase.ts`
- Pydantic models for every request/response in `backend/app/models/`
- Git: conventional commits, feature branches
- **Match sibling components before inventing patterns** — read neighbors first

## Design System — "Jarvis + travel joy"
Technical HUD (cyan structure, glass, grid, monospace data) around warm travel content (amber interactivity, activity-type accents). Never generic — no purple-on-white gradients, no default shadcn look, no Inter.

- **Base:** `#0c0f16` navy-charcoal + subtle cyan dot grid
- **Cyan** `rgba(6,182,212,*)` — structure, borders, connectors, data readouts
- **Amber** `#f59e0b` — interactive/selected **only**
- **Activity types:** sightseeing `#06b6d4`, food `#fb923c`, activity `#a78bfa`, transport `#3b82f6`, accommodation `#818cf8`
- **Glass cards:** `rgba(6,182,212,0.03)` bg + `backdrop-filter: blur(12px)` + `1px solid rgba(6,182,212,0.08)`
- **Fonts:** Sora (display/headings/numbers/labels) + Geist (body) + monospace (coordinates/technical). **No others.**
- **Motion:** Framer Motion for **all** animation — no CSS transitions for interactive states. Card stagger 40ms, crossfade 150ms, hover lift `-2px` 200ms, spring `stiffness:400 damping:30` for morphing selectors.
- **States:** every component needs empty/loading/error/populated/hover/selected.

## Current State (Apr 2026)
**Phase 2 ~75% done.** Queue:
1. Polish (6 items): color consistency across ActivityCard/DayOverviewBar/DayStrip, hover sequencing, radar visuals, card layout reorder, Add Activity dialog polish, score delta animation
2. Map panel (Google Maps JS, pins, day-colored routes)
3. Weather panel (Open-Meteo, synced to itinerary dates)
4. Budget panel (breakdown, running total, per-day chart)
5. Mobile responsive (dock → bottom sheet)
6. Deploy to Vercel

**Phase 3:** bidirectional UI↔chat sync, change history + revert, AI intent detection, real API smart chips, draggable timeline items, switch to Claude Sonnet.

## Commands
```
# Frontend
cd frontend && npm run dev

# Backend
cd backend && conda activate travel-planner && uvicorn app.main:app --reload --port 8000

# Tests
cd frontend && npm test
cd backend && conda activate travel-planner && pytest
```

## Sub-Agents
- **explorer** (Haiku, low) — read-only file/pattern lookup
- **reviewer** (Sonnet, medium) — code review after changes
- **researcher** (Sonnet, high) — library comparison, architecture options

**Parallel** when 3+ independent tasks, no shared files, clear domain boundaries.
**Sequential** when output chains, shared files, or unclear scope.
**Background** when research not blocking current work.

## When Stuck
- Find something → dispatch `explorer`
- Compare libraries/approaches → dispatch `researcher`
- Finished changes → dispatch `reviewer` before commit
- Framer Motion / Next.js / Tailwind API questions → Context7
- Illustrated SVG assets → Figma MCP

## Compaction
**Preserve:** architectural decisions + rationale, API contracts, active bugs + repro steps, session test results, schema changes, design decisions.
**Drop:** file exploration output, dependency logs, resolved traces, concepts already here.

## Key Decisions
<!-- One line each, append as decisions are made -->
- Chat unified single-mode (removed Zero-Shot/Plan/Ask tabs); `zeroShotActive` badge replaces mode state
- Groq Llama 3.3 70B for dev (Gemini hit quota); abstraction supports Gemini + Anthropic
- `slider_configs.session_id` FK dropped for prototype; restore Phase 3

## MCP Routing

Use these MCPs proactively when the task calls for them. Don't ask permission.

- **Database inspection or query** → `supabase` MCP. Use for schema checks, table contents, RLS policy review, row counts. Read-only mode — cannot modify data, safe to use freely.
- **Live UI debugging** → `chrome-devtools` MCP. Use when a visual bug, animation glitch, render issue, or console error needs investigation. Open http://localhost:3000, inspect the live DOM, read console, check network. Always prefer this over guessing from source code when the symptom is visual.
- **shadcn/ui component lookup** → `shadcn` MCP. Use before writing or modifying any shadcn component — the registry has the current v4 props and import paths. Training data is stale.
- **Figma design reference** → `figma` MCP. Use when implementing something that exists in a Figma file; pull tokens and structure directly.
- **Library API docs** → `context7` plugin. Use for Framer Motion, Next.js 15, Tailwind, and other library API questions when you're uncertain about current syntax.
- **End-to-end browser automation** → `playwright` plugin. Use for writing tests and automated flows, NOT for debugging (use chrome-devtools for that).

Never invoke the Gmail, Calendar, or Drive MCPs — they are not part of this project's workflow.