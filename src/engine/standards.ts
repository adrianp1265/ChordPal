import raw from './standards.json';
import { TYPE_BY_CODE, type TypeId } from '../theory/chordTypes';
import type { Chord } from '../theory/chord';
import type { Key, Mode } from '../theory/keys';
import { DEGREES, fromLabel, toLabel } from '../theory/numerals';
import { mod12 } from '../theory/pitch';

export interface Example { song: string; artist: string; from?: string }
export interface Standard {
  id: string;
  name: string;
  aka: string;
  mode: Mode;
  labels: string[];
  loop: boolean;
  about: string;
  bars?: string[];
  examples: Example[];
}

export const STANDARDS = raw as Standard[];

/** Songs per genre and how many contain each standard (any key, any rotation of a loop). */
export type StandardStats = Record<string, { songs: number; std: Record<string, number> }>;

// Extensions fold into the triad for matching: G7 is a 5, Am7 a 6m (same as the pipeline).
const QUALITY: Record<TypeId, string> = {
  maj: '', '7': '', maj7: '', add9: '', '6': '', '9': '', maj9: '', sus2: '', sus4: '',
  m: 'm', m7: 'm', m6: 'm', m9: 'm', dim: 'dim', dim7: 'dim', m7b5: 'dim', aug: 'aug',
};
const LABEL_RE = /^(b2|b3|#4|b6|b7|[1-7])(.*)$/;

export const quality = (type: TypeId) => QUALITY[type];

/** "57" -> "5", "2m7" -> "2m", "7m7b5" -> "7dim". */
export function simplify(label: string): string {
  const m = LABEL_RE.exec(label);
  if (!m) return label;
  return m[1] + QUALITY[TYPE_BY_CODE[m[2]]?.id ?? 'maj'];
}

const degreeOf = (label: string) => DEGREES.indexOf(LABEL_RE.exec(label)![1]);

export interface Placed {
  standard: Standard;
  key: Key;
  /** Labels and chords in play order (a loop rotated to start on your chord). */
  labels: string[];
  chords: Chord[];
  /** Index in the standard's own order where your chord sits. */
  at: number;
  /** Share of songs in the genre that contain the standard. */
  share: number | null;
}

export function shareOf(st: Standard, stats: StandardStats | null, genre: string): number | null {
  const g = stats?.[genre];
  return g && g.songs ? (g.std[st.id] ?? 0) / g.songs : null;
}

/** A standard written out in a key, starting at `start` (loops only). */
export function place(st: Standard, key: Key, start = 0, stats: StandardStats | null = null, genre = 'all'): Placed {
  const labels = st.loop ? [...st.labels.slice(start), ...st.labels.slice(0, start)] : st.labels;
  return { standard: st, key, labels, chords: labels.map((l) => fromLabel(l, key)!), at: start, share: shareOf(st, stats, genre) };
}

/**
 * The standards your chord can start: every place in a standard whose chord
 * quality matches yours. The key follows from that place (Am as the 6m of a
 * major-key loop puts you in C major). Loops are rotated to start on your
 * chord; other standards only count when your chord is their first chord.
 * Your exact chord (Am7, G/B...) replaces the standard's at that spot. A
 * dominant 7th prefers the 5 spot.
 */
export function standardsWith(chord: Chord, stats: StandardStats | null, genre: string): Placed[] {
  const out: Placed[] = [];
  const q = quality(chord.type);
  for (const st of STANDARDS) {
    // A dominant 7th (G7) almost always works as the 5, so try that spot first.
    const order = st.labels.map((_, j) => j);
    if (chord.type === '7') order.sort((a, b) => Number(degreeOf(st.labels[b]) === 7) - Number(degreeOf(st.labels[a]) === 7));
    for (const j of order) {
      if (!st.loop && j > 0) continue;
      const s = simplify(st.labels[j]);
      if (s.replace(/^(b2|b3|#4|b6|b7|[1-7])/, '') !== q) continue;
      const key: Key = { tonic: mod12(chord.root - degreeOf(st.labels[j])), mode: st.mode };
      const p = place(st, key, j, stats, genre);
      p.chords[0] = chord;
      p.labels[0] = toLabel(chord, key);
      out.push(p);
      break; // one placement per standard (the first)
    }
  }
  return out.sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
}
