/** Deterministic 0–1 value for stable procedural geometry (eslint-safe, SSR-safe). */
export function seededUnit(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function seededRange(seed: number, min: number, max: number): number {
  return min + seededUnit(seed) * (max - min);
}
