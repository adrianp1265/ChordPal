import { pcDist, pcStep, mod12 } from './pitch';

/**
 * Fewest total semitones to move from chord A to chord B (pitch classes, short
 * way round). Every note of each chord is matched to at least one note of the
 * other, so a 3-note chord can double notes to meet a 5-note one. Exact: try
 * every map of A's notes onto B's, then cover B's leftover notes by their
 * cheapest partner in A. With 5 notes at most that is under 3,200 maps.
 */
export function moveCost(a: number[], b: number[]): { cost: number; pairs: [number, number][] } {
  if (a.length === 0 || b.length === 0) return { cost: 0, pairs: [] };
  let best = Infinity;
  let bestPairs: [number, number][] = [];
  const pick = new Array(a.length).fill(0);
  const total = b.length ** a.length;
  for (let n = 0; n < total; n++) {
    let x = n;
    for (let i = 0; i < a.length; i++) { pick[i] = x % b.length; x = Math.floor(x / b.length); }
    let cost = 0;
    const covered = new Array(b.length).fill(false);
    for (let i = 0; i < a.length; i++) { cost += pcDist(a[i], b[pick[i]]); covered[pick[i]] = true; }
    if (cost >= best) continue;
    const extra: [number, number][] = [];
    for (let j = 0; j < b.length && cost < best; j++) {
      if (covered[j]) continue;
      let bi = 0;
      for (let i = 1; i < a.length; i++) if (pcDist(a[i], b[j]) < pcDist(a[bi], b[j])) bi = i;
      cost += pcDist(a[bi], b[j]);
      extra.push([a[bi], b[j]]);
    }
    if (cost < best) {
      best = cost;
      bestPairs = [...a.map((p, i) => [p, b[pick[i]]] as [number, number]), ...extra];
    }
  }
  return { cost: best, pairs: bestPairs };
}

/** Smoothness 0..1: 1 = no movement, 0 = 12 semitones or more. */
export const smoothness = (cost: number) => 1 - Math.min(cost, 12) / 12;

/**
 * Place target pitch classes as close as possible to the held MIDI notes,
 * following the cheapest matching. Returns sorted MIDI notes.
 */
export function voiceNear(held: number[], target: number[]): number[] {
  if (held.length === 0) return [];
  const heldPcs = [...new Set(held.map(mod12))];
  const { pairs } = moveCost(heldPcs, [...new Set(target.map(mod12))]);
  const out = new Set<number>();
  for (const [from, to] of pairs) {
    // move every held note of this pitch class
    for (const h of held) if (mod12(h) === from) out.add(h + pcStep(from, to));
  }
  return [...out].sort((x, y) => x - y);
}
