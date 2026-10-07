import type { Chord } from './chord';
import { TYPE_BY_CODE, TYPE_BY_ID } from './chordTypes';
import type { Key } from './keys';
import { mod12 } from './pitch';

// Degree names by semitones above the tonic, same in major and minor:
// A minor's F is "b6", its G is "b7".
export const DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];
const DEGREE_INDEX = Object.fromEntries(DEGREES.map((d, i) => [d, i]));

/** Chord -> table label, e.g. Am in C major -> "6m", F in C -> "4". */
export const toLabel = (c: Chord, k: Key) => DEGREES[mod12(c.root - k.tonic)] + TYPE_BY_ID[c.type].code;

/** Table label -> chord in the key, or null if the label is not one of the 17 types. */
export function fromLabel(label: string, k: Key): Chord | null {
  const m = /^(b2|b3|#4|b6|b7|[1-7])(.*)$/.exec(label);
  if (!m) return null;
  const t = TYPE_BY_CODE[m[2]];
  if (!t || DEGREE_INDEX[m[1]] === undefined) return null;
  return { root: mod12(k.tonic + DEGREE_INDEX[m[1]]), type: t.id };
}

/** How a label is shown: "♭7", "6m", "4maj7", and "2 7" (thin space) so D7 in C never reads as 27. */
export function prettyLabel(label: string): string {
  const m = /^(b2|b3|#4|b6|b7|[1-7])(.*)$/.exec(label);
  if (!m) return label;
  const deg = m[1].replace(/^b/, '♭').replace(/^#/, '♯');
  const type = m[2].replace('m7b5', 'm7♭5');
  return deg + (/^\d/.test(type) ? '\u202f' : '') + type;
}
