# AI Travel Planner

## Overview
AI-powered travel planning app. Users choose a mode (Zero-Shot, Plan, Ask), chat with AI, and get visual trip plans. The key differentiator: instead of "where do you want to go?", we ask "when are you free?" and recommend destinations based on weather, cost, activities.

## Tech Stack
- Frontend: Next.js 15 + React + TypeScript + Tailwind CSS + shadcn/ui (Radix + Nova)
- Backend: FastAPI + Python 3.11
- Database: Supabase (PostgreSQL + Auth)
- State Management: Zustand
- Animations: Framer Motion
- AI: Gemini 2.0 Flash (dev), Claude API (production)
- Maps: Google Maps Platform

## Architecture
- Frontend runs on port 3000 (Next.js App Router)
- Backend runs on port 8000 (FastAPI)
- Frontend calls backend via NEXT_PUBLIC_API_URL
- Supabase handles auth and direct DB reads from frontend
- Backend handles AI calls, data enrichment, business logic

## Conventions
- React components: PascalCase (ChatPanel.tsx)
- Python files: snake_case (ai_provider.py)
- All Pydantic models in backend/app/models/
- All prompts in backend/app/prompts/
- shadcn/ui components in frontend/src/components/ui/

## Design Philosophy
- No compromise on visual aesthetics
- No generic AI aesthetics (no purple gradients on white, no Inter font)
- Use Framer Motion for all animations
- Distinctive typography from Google Fonts or Fontshare
- Dark theme with warm accents as default

## Commands
- Frontend: cd frontend && npm run dev
- Backend: cd backend && conda activate travel-planner && uvicorn app.main:app --reload --port 8000

## Current Phase
Phase 1, Week 1: Building auth + login page