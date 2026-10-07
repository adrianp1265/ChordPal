import { sameChord, type Chord } from '../theory/chord';
import type { Key } from '../theory/keys';
import { fromLabel, toLabel } from '../theory/numerals';
import { genreP, type Table } from './tables';

export interface Progression {
  chords: Chord[];
  labels: string[];
  /** Chance songs continue this way after the first chord (product of each step). */
  p: number;
}

/**
 * The most common ways songs continue after `start`: a beam search through the
 * tables, each step using up to 3 chords of context (blended like the
 * suggestions). Returns `count` progressions of `length` chords, start included.
 */
export function topProgressions(
  start: Chord, key: Key, genre: Table | null, all: Table | null,
  { length = 4, count = 8, beam = 80, before = [] as string[] } = {},
): Progression[] {
  const first = toLabel(start, key);
  let paths: { labels: string[]; p: number }[] = [{ labels: [first], p: 1 }];
  for (let step = 1; step < length; step++) {
    const next: typeof paths = [];
    for (const path of paths) {
      const ctx = [...before, ...path.labels].slice(-3);
      const dist = genreP(genre, all, ctx);
      if (!dist) return [];
      for (const [label, q] of dist) {
        if (label === path.labels[path.labels.length - 1] || !fromLabel(label, key)) continue;
        next.push({ labels: [...path.labels, label], p: path.p * q });
      }
    }
    next.sort((a, b) => b.p - a.p);
    paths = next.slice(0, beam);
  }
  // From 4 chords up, skip two-chord back-and-forth (C F C F): common, but not much of a progression.
  const varied = length >= 4 ? paths.filter((x) => new Set(x.labels).size >= 3) : paths;
  return varied.slice(0, count).map(({ labels, p }) => ({
    labels,
    p,
    chords: labels.map((l, i) => (i === 0 ? start : fromLabel(l, key)!)),
  }));
}

/** Same chord twice in a row never happens (the tables collapse repeats); exported for tests. */
export const noRepeats = (pr: Progression) => pr.chords.every((c, i) => i === 0 || !sameChord(c, pr.chords[i - 1]));

