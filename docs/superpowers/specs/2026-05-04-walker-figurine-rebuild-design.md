# Walker Figurine Rebuild — Design Spec
*Date: 2026-05-04*

## Overview

Four scoped changes to the WalkerLayer component and its associated CSS animation:

1. Replace the 18×18 head-on stroke SVG with a 18×36 filled side-view walking silhouette
2. Replace vertical `travelerBob` animation with horizontal `travelerSway`
3. Re-anchor the figure and ring from vertical-center to bottom of sky region
4. Confirm PersonStanding removal (already absent — no code change needed)

---

## 1. SVG Figurine

**File:** `frontend/src/components/sky/atmosphere/WalkerLayer.tsx`

- **Element type:** inline `<svg>` — no Lucide import, no external asset
- **Dimensions:** `width="18" height="36" viewBox="0 0 18 36"`
- **Fill:** `rgba(255,255,255,0.78)`, no stroke, no strokeWidth
- **Shadow:** `filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4))` on the silhouette wrapper div
- **Pose:** side-view mid-stride (figure facing right):
  - Head: filled circle at top (~cx=11, cy=4.5, r=3.5)
  - Body path (single `<path d="..."/>`): torso angled slightly forward, one arm swinging
    forward (visible from side), front leg extending forward-right, back leg extending
    backward-left — classic pedestrian-crossing sign pose
  - Single static pose; no frame cycling. Motion comes entirely from the sway animation.
- **Existing amber glow filter removed.** The drop-shadow replaces the amber glow since
  the figure is now a white silhouette rather than a stroke icon.

---

## 2. Positioning — bottom-anchored

**File:** `frontend/src/components/sky/atmosphere/WalkerLayer.tsx`

Replace `top: 50%, transform: translate(-50%, -50%)` on the outer container with:

```
position: absolute
bottom: 0
left: `${xPercent}%`
transform: translateX(-50%)     ← horizontal centering only
pointerEvents: none
zIndex: 0
```

The figure's feet sit at `bottom: 0` of the sky region (Layer 1), grounding the
character on the scenery rather than floating at vertical center.

**Ring:** re-anchor from `top: 50%, left: 50%` to:

```
position: absolute
bottom: -4px                    ← ring base slightly below figure feet
left: 50%
transform: translateX(-50%)
width: 44, height: 44           ← scaled up from 26px to match 36px figure
borderRadius: 50%
```

Ring `animation: travelerRingPulse 2s ease-in-out infinite` is unchanged.

---

## 3. Animation — travelerSway

**File:** `frontend/src/app/globals.css`

**Delete** `travelerBob` keyframes (currently lines 161–164):
```css
@keyframes travelerBob {
  0%, 100% { transform: translate(-50%, -100%) translateY(0); }
  50% { transform: translate(-50%, -100%) translateY(-3px); }
}
```

**Add** `travelerSway` immediately before `travelerRingPulse`:
```css
@keyframes travelerSway {
  0%, 100% { transform: translateX(-2px); }
  50%      { transform: translateX(2px); }
}
```

The container already applies `translateX(-50%)` for centering. The sway therefore
only expresses the ±2px weight-shift motion — no Y component anywhere in the render path.

**Silhouette wrapper in WalkerLayer.tsx:**
```
animation: travelerSway 1s ease-in-out infinite
```
Duration 1s (slower than the old 1.4s bob, suggests gentle weight-shift not jumping).
`transformOrigin` on the wrapper is not needed; remove it.

---

## 4. PersonStanding cleanup

`PersonStanding` has **zero references** in the codebase (confirmed via grep of
`frontend/src/`). The visual artifact the user observed is the current WalkerLayer
SVG centered at `top: 50%` — which visually overlaps the annotation strip area.
Re-anchoring the figure to `bottom: 0` in change #2 resolves the visual confusion.

**No code changes required for item 4.**

---

## 5. TypeScript verification

Run `tsc --noEmit` from `frontend/` after changes. Expected: zero errors.

---

## Reviewer checklist (post-implementation)

- (a) SVG renders recognizable side-view walking silhouette (head, torso, arm, two legs) — NOT head-on
- (b) No `translateY`, no Y in keyframes anywhere in the walker render path
- (c) Walker feet at bottom of sky region, not floating at center
- (d) PersonStanding: zero references in AnnotationStrip.tsx
- (e) `tsc --noEmit` clean
