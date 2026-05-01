'use client';
import { useSyncExternalStore } from 'react';

// Tiny shared store so RainField can sync particle color with LightningFlash
// without forcing the canvas component to re-render on every flash.
let active = false;
const listeners = new Set<() => void>();

export function setLightningFlashActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const listener of listeners) listener();
}

// Imperative read — for the rAF loop, which must not subscribe-and-rerender.
export function getLightningFlashActive(): boolean {
  return active;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLightningFlashActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false,
  );
}
