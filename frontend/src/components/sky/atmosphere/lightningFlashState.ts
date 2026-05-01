'use client';

// Imperative singleton so StormLayer's rAF tick can read flash state without
// subscribing (which would cause a re-render on every flash tick).
let active = false;

export function setLightningFlashActive(next: boolean): void {
  if (active === next) return;
  active = next;
}

export function getLightningFlashActive(): boolean {
  return active;
}
