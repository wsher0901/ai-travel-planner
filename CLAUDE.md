# AI Travel Planner

## Overview
AI-powered travel planning app. Users choose a mode (Zero-Shot, Plan, Ask), chat with AI, and get visual trip plans. Key differentiator: instead of "where do you want to go?", we ask "when are you free?" and recommend destinations based on weather, cost, activities.

## Tech Stack
- Frontend: Next.js 15 App Router + React + TypeScript + Tailwind CSS + shadcn/ui (Radix + Nova)
- Backend: FastAPI + Python 3.11
- Database: Supabase (PostgreSQL + Auth)
- State: Zustand
- Animations: Framer Motion
- AI: Gemini 2.0 Flash (dev), Claude API (production)
- Maps: Google Maps Platform

## Architecture
- Frontend: port 3000, calls backend via NEXT_PUBLIC_API_URL
- Backend: port 8000, handles AI calls, data enrichment, business logic
- Supabase: auth + direct DB reads from frontend
- All API routes are RESTful via FastAPI with Pydantic validation

## Conventions
- React components: PascalCase (ChatPanel.tsx)
- Python files: snake_case (ai_provider.py)
- Pydantic models: backend/app/models/
- Prompts: backend/app/prompts/
- shadcn/ui components: frontend/src/components/ui/
- Git: conventional commits, feature branches
- Tests: pytest (backend), vitest (frontend)

## Design Philosophy
- No compromise on visual aesthetics
- No generic AI aesthetics (no purple gradients on white, no Inter font)
- Framer Motion for all animations
- Distinctive typography from Google Fonts or Fontshare
- Dark theme with warm accents as default

## Commands
- Frontend: `cd frontend && npm run dev`
- Backend: `cd backend && conda activate travel-planner && uvicorn app.main:app --reload --port 8000`
- Frontend tests: `cd frontend && npm test`
- Backend tests: `cd backend && conda activate travel-planner && pytest`

## Current Phase
Phase 1, Week 1: Building auth + login page

## Key Decisions
<!-- Update as decisions are made. Keep entries to one line each. -->

## Sub-Agent Routing Rules

**Parallel dispatch** (all conditions met):
- 3+ independent tasks across different domains
- No shared files between tasks
- Clear boundaries (frontend / backend / database)

**Sequential dispatch** (any condition):
- Task B needs output from Task A
- Shared files or state
- Unclear scope — investigate before proceeding

**Background dispatch**:
- Research or analysis not blocking current work
- Documentation lookup or comparison

## Compact Instructions
When compacting, always preserve:
- Architectural decisions and rationale
- API contracts (endpoint signatures, request/response shapes)
- Current bugs under investigation and reproduction steps
- Test results from the current session
- Database schema changes
- Design decisions (typography, color, component choices)

Drop during compaction:
- File exploration and search output
- Verbose dependency resolution logs
- Resolved debugging traces
- Redundant explanations of concepts already in this file