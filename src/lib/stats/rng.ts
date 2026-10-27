/** Générateur pseudo-aléatoire reproductible (mulberry32) : mêmes graines = mêmes résultats. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage uniforme strictement dans ]0, 1[. */
export function uniformOpen(rng: () => number): number {
  let u = rng();
  while (u <= 0) u = rng();
  return u;
}
