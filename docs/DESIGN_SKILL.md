# Frontend Design Skill — Roam

## Design Direction
Roam's aesthetic: luxury/refined dark theme with warm amber energy. Think premium travel app meets modern dashboard. Every component should feel intentional, polished, and alive with subtle motion.

## Rules
- NEVER use generic AI aesthetics: no Inter/Roboto/Arial, no purple gradients, no cookie-cutter layouts
- Font: Sora (via var(--font-sora)) for all text
- Dark theme: zinc-950 backgrounds, zinc-900/800 borders
- Primary accent: amber #f59e0b, highlight #fbbf24
- Mode colors: amber (zero-shot), blue #3b82f6 (plan), green #10b981 (ask)
- Borders: always rgba with low opacity (0.06–0.15), never solid gray
- Backgrounds: layered with subtle gradients, noise, or transparency — never flat solid

## Motion Conventions (Framer Motion)
- Page transitions: 300ms ease-out slide + fade
- Component entry: staggered fade-up, y:12→0, opacity:0→1, 0.35s, 50ms stagger
- Layout shifts: 500ms cubic-bezier(0.4, 0, 0.2, 1)
- Hover states: 150ms scale(1.02) or color shift
- Tab indicators: spring stiffness 400, damping 30
- Loading: skeleton pulse 1.5s cycle
- Exit animations: always include via AnimatePresence

## Component Design Checklist
Every component must define:
- [ ] Default state styling
- [ ] Hover state
- [ ] Active/pressed state
- [ ] Loading/skeleton state
- [ ] Empty state
- [ ] Entry animation
- [ ] Exit animation (if removable)
- [ ] Dark theme contrast (text readability on zinc-950)

## Typography Scale
- Heading large: 42px, weight 700, letter-spacing -0.02em
- Heading: 20px, weight 600
- Body: 14–15px, weight 400
- Small/label: 12–13px, weight 500
- Caption: 11px, weight 400, rgba white 0.25

## Spacing
- Component padding: 16–24px
- Gap between elements: 8–16px
- Section spacing: 24–32px

## Backgrounds & Depth
- Use layered transparency: bg-zinc-950/50 with backdrop-blur-sm
- Subtle gradient glows for emphasis: radial-gradient with mode color at 8–12% opacity
- Border glow on focus/active: box-shadow 0 0 12px {color}15

## Inspiration Sources
- magicui.design — components built on shadcn + Framer Motion + Tailwind
- aceternity.com/components — dark-theme animated effects
- mobbin.com — real app UX patterns
