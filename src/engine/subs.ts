import { sameChord, type Chord } from '../theory/chord';
import type { Key } from '../theory/keys';
import { fromLabel, toLabel } from '../theory/numerals';
import { genreP, type Table } from './tables';

export interface Sub { chord: Chord; label: string; p: number }

/**
 * What else can sit between `prev` and `next`: P(x | prev, next) is
 * proportional to P(x | prev) * P(next | prev, x), both from the song tables.
 * Without a prev, P(x) from overall frequencies; without a next, P(x | prev) alone.
 */
export function substitutes(
  prev: Chord | null, current: Chord, next: Chord | null, key: Key,
  genre: Table | null, all: Table | null, count = 6,
): Sub[] {
  const pl = prev ? toLabel(prev, key) : null;
  const nl = next ? toLabel(next, key) : null;
  const first = genreP(genre, all, pl ? [pl] : []);
  if (!first) return [];
  const scored: Sub[] = [];
  for (const [label, px] of first) {
    const chord = fromLabel(label, key);
    if (!chord || sameChord(chord, current) || sameChord(chord, prev) || sameChord(chord, next)) continue;
    let p = px;
    if (nl) p *= genreP(genre, all, pl ? [pl, label] : [label])?.get(nl) ?? 0;
    if (p > 0) scored.push({ chord, label, p });
  }
  const total = scored.reduce((s, x) => s + x.p, 0) || 1;
  return scored.sort((a, b) => b.p - a.p).slice(0, count).map((x) => ({ ...x, p: x.p / total }));
}
