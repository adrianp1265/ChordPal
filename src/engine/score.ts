import { chordPcs, LIBRARY, sameChord, type Chord } from '../theory/chord';
import type { Key } from '../theory/keys';
import { scalePcs } from '../theory/keys';
import { toLabel } from '../theory/numerals';
import { moveCost, smoothness, voiceNear } from '../theory/voiceLeading';
import { moodWeight, type Mood } from './moods';

export interface Suggestion {
  chord: Chord;
  label: string;
  /** Raw blended probability and scaled 0..1 (top candidate = 1). */
  p: number;
  phat: number;
  /** Smoothness 0..1 and the semitones moved. */
  s: number;
  moves: number;
  shared: number;
  mood: number;
  score: number;
  /** Ghost-key voicing near the held notes (MIDI). */
  voicing: number[];
}

export interface ScoreInput {
  current: Chord;
  key: Key;
  /** P over table labels, or null for the stand-in (equal P for the key's 7 chords). */
  p: Map<string, number> | null;
  mood: Mood;
  /** Adventure dial 0..1. */
  adventure: number;
  /** Notes the user holds now (or the last voicing), for ghost keys. */
  held: number[];
  count?: number;
}

/** Stand-in P before data loads: the 7 diatonic triads, equally likely. */
export function diatonicP(key: Key): Map<string, number> {
  const scale = [...scalePcs(key)];
  const out = new Map<string, number>();
  for (const root of scale) {
    for (const type of ['maj', 'm', 'dim'] as const) {
      const c: Chord = { root, type };
      if (chordPcs(c).every((p) => scale.includes(p))) out.set(toLabel(c, key), 1 / 7);
    }
  }
  return out;
}

export function score(phat: number, s: number, mood: number, a: number) {
  return mood * ((1 - a) * phat + a * s * (1 - phat));
}

export function suggest(inp: ScoreInput): Suggestion[] {
  const { current, key, mood, adventure: a, held } = inp;
  const p = inp.p ?? diatonicP(key);
  const cur = chordPcs(current);
  const rows = LIBRARY.filter((c) => !sameChord(c, current)).map((chord) => {
    const label = toLabel(chord, key);
    const pcs = chordPcs(chord);
    const { cost } = moveCost(cur, pcs);
    return {
      chord, label, pcs,
      p: p.get(label) ?? 0,
      moves: cost,
      s: smoothness(cost),
      shared: pcs.filter((q) => cur.includes(q)).length,
      mood: moodWeight(mood, chord.type),
    };
  });
  const maxP = Math.max(...rows.map((r) => r.p), 0);
  const scored = rows.map((r) => {
    const phat = maxP > 0 ? r.p / maxP : 0;
    return { ...r, phat, score: score(phat, r.s, r.mood, a) };
  });
  scored.sort((x, y) => y.score - x.score || y.p - x.p || y.s - x.s);
  return scored.slice(0, inp.count ?? 8).map(({ pcs, ...r }) => ({ ...r, voicing: voiceNear(held, pcs) }));
}
