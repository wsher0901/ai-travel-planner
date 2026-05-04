# Walker Figurine Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 18×18 head-on stroke walker SVG with a 18×36 filled side-view walking silhouette, re-anchor the figure to the bottom of the sky region, and swap the vertical bob animation for a horizontal sway.

**Architecture:** Two files only. `globals.css` gets a keyframe swap (delete `travelerBob`, add `travelerSway`). `WalkerLayer.tsx` gets a full rewrite of the SVG element, ring sizing, and container positioning. `AnnotationStrip.tsx` is untouched — `PersonStanding` is already absent from the codebase.

**Tech Stack:** React 18, TypeScript, inline SVG, CSS keyframes, inline styles

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/app/globals.css` | Delete `travelerBob` (lines 161–164), add `travelerSway` in its place |
| `frontend/src/components/sky/atmosphere/WalkerLayer.tsx` | Full rewrite of JSX: new SVG, new positioning, new ring size, new animation |
| `frontend/src/components/layout/AnnotationStrip.tsx` | **No changes** — `PersonStanding` already absent |

---

## Task 1: Swap `travelerBob` for `travelerSway` in globals.css

**Files:**
- Modify: `frontend/src/app/globals.css` (lines 161–168)

The current `travelerBob` keyframes encode a Y-axis bob. They must be deleted
entirely. `travelerRingPulse` (lines 165–168) must be left byte-for-byte identical.

- [ ] **Step 1: Replace the travelerBob block**

In `frontend/src/app/globals.css`, the block currently reads (lines 161–168):

```css
@keyframes travelerBob {
  0%, 100% { transform: translate(-50%, -100%) translateY(0); }
  50% { transform: translate(-50%, -100%) translateY(-3px); }
}
@keyframes travelerRingPulse {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
}
```

Replace the `travelerBob` block only. The result must be:

```css
@keyframes travelerSway {
  0%, 100% { transform: translateX(-2px); }
  50%      { transform: translateX(2px); }
}
@keyframes travelerRingPulse {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
}
```

`travelerSway` uses only X-axis motion (±2px weight-shift). The container in
WalkerLayer.tsx handles horizontal centering via `transform: translateX(-50%)` —
the animation expresses only the sway offset, never re-applying the -50% centering.

- [ ] **Step 2: Verify no stale `travelerBob` reference remains**

```bash
grep -r "travelerBob" frontend/src/
```

Expected: no output (exit 0, empty).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "fix(walker): replace travelerBob with travelerSway — horizontal ±2px sway, no Y motion"
```

---

## Task 2: Rewrite WalkerLayer.tsx

**Files:**
- Modify: `frontend/src/components/sky/atmosphere/WalkerLayer.tsx`

Complete replacement of the JSX block. The component signature, imports, and early-return
guard are unchanged. Everything inside `return (...)` is rewritten.

### Layout rationale

| Element | Old | New |
|---------|-----|-----|
| Container anchor | `top: 50%, transform: translate(-50%,-50%)` | `bottom: 0, transform: translateX(-50%)` |
| Container size | none (shrink-wraps) | `width: 44, height: 44` |
| Ring size | 26×26 | 44×44 |
| Ring anchor | `top: 50%, left: 50%` | `top: 50%, left: 50%` (unchanged — animation handles center) |
| Silhouette anchor | `position: relative` (flow) | `position: absolute, bottom: 0, left: 50%, marginLeft: -9` |
| Silhouette z-index | above ring (DOM order — but ring was absolute, so order was ambiguous) | `zIndex: 1` (explicitly above ring's `zIndex: 0`) |
| Animation | `travelerBob 1.4s` | `travelerSway 1s` |
| SVG | 18×18, stroke, head-on | 18×36, fill, side-view |
| Filter | amber glow | dark drop-shadow |

The container is 44×44 to match the ring. The silhouette uses `left: 50%, marginLeft: -9`
(half of the 18px SVG width) to center its 18px-wide body without needing `transform`
(which the animation would override). `travelerSway` then applies only `translateX(±2px)`.

The ring animation (`travelerRingPulse`) bakes `translate(-50%, -50%)` into its keyframes,
so no inline `transform` is needed on the ring div — the animation handles centering.

### SVG silhouette path

ViewBox `0 0 18 36`. Single filled `<path>` traces the outline of a side-view mid-stride
figure facing right (path goes clockwise from front shoulder):

| Point | Landmark |
|-------|----------|
| M 13.5,8 | Front shoulder |
| L 15.5,13 | Front arm extends forward-right |
| L 14,14.5 | Arm tip/wrist |
| L 12.5,12 | Inner arm, back toward torso |
| L 13.5,20 | Front hip |
| L 15.5,27 | Front knee/shin (forward stride) |
| L 17,35 | Front toe |
| L 15,36 | Front foot sole |
| L 13.5,35 | Front heel |
| L 12.5,27 | Inner front shin |
| L 10.5,22 | Crotch / inner thigh junction |
| L 8.5,27 | Inner back shin |
| L 7,34 | Back heel |
| L 5,34 | Back foot outer edge |
| L 6.5,27 | Back shin |
| L 7.5,20 | Back hip |
| L 7,14 | Back torso |
| L 5.5,17.5 | Back arm swinging backward-left |
| L 7,18.5 | Back arm inner edge |
| L 7.5,13.5 | Back shoulder |
| L 8,8 | Back of neck |
| Z | Closes across shoulder line to M (13.5,8) |

Head: `<circle cx="11" cy="4" r="3.5" />` — overlaps top of path naturally for a
filled silhouette (no gap at neck).

- [ ] **Step 1: Write the new WalkerLayer.tsx**

Replace the entire content of `frontend/src/components/sky/atmosphere/WalkerLayer.tsx`
with:

```tsx
'use client';
import type { WalkerPreset } from '@/components/sky/types';

interface Props {
  xPercent: number | null;
  preset: WalkerPreset;
}

// Walker sits between Layer 2b (scenery) and Layer 3b (rain/snow particles)
// so precipitation falls visually in front of the character.
// No internal timer — xPercent is the single time-driven input, derived from
// SkyStrip's currentMinute so timezone handling stays in one place.
export default function WalkerLayer({ xPercent, preset }: Props) {
  if (xPercent === null || preset === 'none') return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        bottom: 0,
        left: `${xPercent}%`,
        transform: 'translateX(-50%)',
        width: 44,
        height: 44,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Pulsing ambient ring — behind silhouette via zIndex */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(245,158,11,0.28) 0%, transparent 70%)',
          animation: 'travelerRingPulse 2s ease-in-out infinite',
          zIndex: 0,
        }}
      />
      {/* Side-view walking silhouette */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          marginLeft: -9,
          zIndex: 1,
          animation: 'travelerSway 1s ease-in-out infinite',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
        }}
      >
        <svg
          width="18"
          height="36"
          viewBox="0 0 18 36"
          fill="rgba(255,255,255,0.78)"
        >
          {/* Head */}
          <circle cx="11" cy="4" r="3.5" />
          {/* Body: torso, front arm (forward), front leg, back leg, back arm (backward) */}
          <path d="M13.5,8 L15.5,13 L14,14.5 L12.5,12 L13.5,20 L15.5,27 L17,35 L15,36 L13.5,35 L12.5,27 L10.5,22 L8.5,27 L7,34 L5,34 L6.5,27 L7.5,20 L7,14 L5.5,17.5 L7,18.5 L7.5,13.5 L8,8 Z" />
        </svg>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify no stale references**

```bash
grep -r "travelerBob\|PersonStanding\|translateY\|top.*50%.*translate.*-50%.*-50%" frontend/src/components/sky/atmosphere/WalkerLayer.tsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/sky/atmosphere/WalkerLayer.tsx
git commit -m "feat(walker): 36px side-view walking silhouette, bottom-anchor, sway animation"
```

---

## Task 3: TypeScript verification

**Files:** (read-only)

There are no TypeScript-specific changes — no new types, no changed interfaces.
This task confirms the file edits didn't introduce type errors.

- [ ] **Step 1: Run tsc --noEmit from the frontend directory**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exits with code 0, zero lines of error output.

If errors appear — likely causes and fixes:

| Error | Fix |
|-------|-----|
| `Cannot find name 'WalkerPreset'` | `WalkerPreset` type was moved; find it with `grep -r "WalkerPreset" frontend/src/` and update the import |
| `Type 'number' is not assignable to type 'string'` on `marginLeft: -9` | React CSSProperties accepts `number` for unitless pixel values — this should not error; if it does, change to `marginLeft: '-9px'` |
| Any other error | Read the file + line number from the error output, fix the specific issue |

- [ ] **Step 2: If tsc is clean, note it and move on**

No commit needed — no files changed.

---

## Task 4: Reviewer

Dispatch the `reviewer` subagent with this exact prompt:

```
Review the diff of WalkerLayer.tsx and globals.css on the current branch against main.
Check each item and report pass/fail with file + line for any failure:

(a) SVG in WalkerLayer.tsx contains a <circle> (head) plus a <path> that traces a side-view
    walking silhouette (head, torso, two legs, one arm visible) — NOT a head-on standing pose.
    Confirm fill="rgba(255,255,255,0.78)" and no stroke attributes.

(b) No translateY anywhere in the walker render path. Check: travelerSway keyframes in
    globals.css, all style objects in WalkerLayer.tsx. Zero Y-axis motion.

(c) Container in WalkerLayer.tsx uses bottom: 0, NOT top: 50%. Walker feet rest at the
    bottom of the sky region.

(d) PersonStanding has zero references in AnnotationStrip.tsx (confirm with grep).

(e) tsc --noEmit from frontend/ exits clean.

Report each check individually. List the exact line for any failure.
```
