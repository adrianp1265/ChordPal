import { CHORD_TYPES, TYPE_BY_ID, type TypeId } from './chordTypes';
import { mod12, pcName } from './pitch';

export interface Chord {
  root: number;
  type: TypeId;
  /** Bass pitch class when it is not the root (slash chord). */
  bass?: number;
}

export const chordPcs = (c: Chord) => TYPE_BY_ID[c.type].intervals.map((i) => mod12(c.root + i));

export const chordName = (c: Chord) =>
  pcName(c.root) + TYPE_BY_ID[c.type].suffix + (c.bass !== undefined && c.bass !== c.root ? '/' + pcName(c.bass) : '');

export const chordId = (c: Chord) => `${c.root}:${c.type}`;

export const sameChord = (a: Chord | null | undefined, b: Chord | null | undefined) =>
  !!a && !!b && a.root === b.root && a.type === b.type;

/** All 204 library chords: 12 roots x 17 types. */
export const LIBRARY: Chord[] = [];
for (let root = 0; root < 12; root++) for (const t of CHORD_TYPES) LIBRARY.push({ root, type: t.id });

/** A default voicing around middle C: root in octave 3/4, notes stacked upward. */
export function defaultVoicing(c: Chord): number[] {
  const base = c.root >= 7 ? 36 + c.root : 48 + c.root; // chord root lands between G3 and F#4
  const notes = TYPE_BY_ID[c.type].intervals.map((i) => base + 12 + i);
  if (c.bass !== undefined && c.bass !== c.root) notes.unshift((c.bass >= 7 ? 36 : 48) + c.bass);
  return notes;
}
