// Deterministic seeded PRNG. Use this when you need reproducible "random" output
// (e.g., star fields, tree silhouettes, scenery details) so that React renders
// produce identical results from the same seed.
export function mulberry32(a: number): () => number {
  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
