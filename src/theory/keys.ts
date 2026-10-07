import { chordPcs, type Chord } from './chord';
import { TYPE_BY_ID } from './chordTypes';
import { mod12, pcName } from './pitch';

export type Mode = 'major' | 'minor';
export interface Key { tonic: number; mode: Mode }

// Krumhansl-Kessler key profiles, index 0 = tonic.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]; // natural minor

export const keyName = (k: Key) => `${pcName(k.tonic)} ${k.mode}`;
export const sameKey = (a: Key, b: Key) => a.tonic === b.tonic && a.mode === b.mode;

export function scalePcs(k: Key): Set<number> {
  return new Set((k.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE).map((i) => mod12(k.tonic + i)));
}

function pearson(a: number[], b: number[]) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Pitch-class weights of a chord list: each chord tone counts 1, the root counts 1 more. */
export function pcWeights(chords: Chord[]): number[] {
  const w = new Array(12).fill(0);
  for (const c of chords) {
    for (const p of chordPcs(c)) w[p] += 1;
    w[c.root] += 1;
  }
  return w;
}

/** All 24 keys scored against the weights, best first. */
export function rankKeys(weights: number[]): { key: Key; r: number }[] {
  const out: { key: Key; r: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = weights.map((_, i) => weights[mod12(i + tonic)]);
    out.push({ key: { tonic, mode: 'major' }, r: pearson(rot, KK_MAJOR) });
    out.push({ key: { tonic, mode: 'minor' }, r: pearson(rot, KK_MINOR) });
  }
  return out.sort((a, b) => b.r - a.r);
}

export const bestKey = (chords: Chord[]) => rankKeys(pcWeights(chords))[0].key;

/** Until the key is clear, the current chord is home. */
export const homeKey = (c: Chord): Key => ({ tonic: c.root, mode: TYPE_BY_ID[c.type].minor ? 'minor' : 'major' });

/**
 * Tracks the key from the last `window` chords. A new key takes over only once
 * it has led for `hold` chords in a row, so one stray chord never flips it.
 */
export class KeyTracker {
  key: Key | null = null;
  private lead: Key | null = null;
  private leadCount = 0;
  private history: Chord[] = [];
  private window: number;
  private hold: number;
  private minChords: number;
  constructor(window = 8, hold = 2, minChords = 3) {
    this.window = window;
    this.hold = hold;
    this.minChords = minChords;
  }

  reset() {
    this.key = null;
    this.lead = null;
    this.leadCount = 0;
    this.history = [];
  }

  /** The chords considered so far (newest last). */
  get chords() { return this.history; }

  push(c: Chord): Key {
    this.history.push(c);
    if (this.history.length > this.window) this.history.shift();
    if (this.history.length < this.minChords) return homeKey(c);
    const best = bestKey(this.history);
    if (!this.key) {
      this.key = best;
      return best;
    }
    if (sameKey(best, this.key)) {
      this.lead = null;
      this.leadCount = 0;
    } else if (this.lead && sameKey(best, this.lead)) {
      this.leadCount++;
    } else {
      this.lead = best;
      this.leadCount = 1;
    }
    if (this.lead && this.leadCount >= this.hold) {
      this.key = this.lead;
      this.lead = null;
      this.leadCount = 0;
    }
    return this.key;
  }
}
