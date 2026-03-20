# Rules for Claude Code

## Design
- No generic AI aesthetics (no purple gradients, no Inter font)
- Use Framer Motion for ALL animations and transitions
- shadcn/ui as the component foundation
- Dark theme with warm amber (#f59e0b) as primary accent
- Font: Sora or Outfit for headings, DM Sans for body

## Frontend
- All components in frontend/src/components/{chat,planning,layout,ui}/
- State management via Zustand stores in frontend/src/stores/
- Never use localStorage in components — use Zustand
- API calls go through frontend/src/lib/api.ts
- Supabase client in frontend/src/lib/supabase.ts

## Backend
- All AI calls go through the provider abstraction layer (app/services/ai_provider.py)
- Never call AI APIs directly from routers — always through services
- Pydantic models for all request/response schemas in app/models/
- Log every user action to preference_signals table
- Rate limit all public endpoints

## Git
- Commit after every working feature
- Branch for experimental UI changes