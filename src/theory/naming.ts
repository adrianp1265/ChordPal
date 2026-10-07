import { CHORD_TYPES } from './chordTypes';
import type { Chord } from './chord';
import { chordName } from './chord';
import { mod12, pcName } from './pitch';

export type Detected =
  | { kind: 'chord'; chord: Chord; name: string }
  | { kind: 'power'; root: number; name: string }
  | { kind: 'interval'; name: string }
  | { kind: 'notes'; name: string }
  | { kind: 'none'; name: '' };

const INTERVAL_NAMES = ['unison', 'm2', 'M2', 'm3', 'M3', 'P4', 'tritone', 'P5', 'm6', 'M6', 'm7', 'M7'];

/** Types that may drop their perfect fifth and still be recognised. */
const OMIT5_OK = new Set(['7', 'maj7', 'm7', '9', 'maj9', 'm9']);

/**
 * Name the held notes. `notes` are MIDI numbers in any order; `keyPcs` are the
 * pitch classes of the current key's scale, used to break ties (a root in the
 * key wins, then the simpler name, then a root in the bass).
 */
export function detect(notes: number[], keyPcs?: Set<number>): Detected {
  if (notes.length === 0) return { kind: 'none', name: '' };
  const sorted = [...notes].sort((a, b) => a - b);
  const bass = mod12(sorted[0]);
  const pcs = [...new Set(sorted.map(mod12))];
  const set = new Set(pcs);

  if (pcs.length === 1) return { kind: 'notes', name: pcName(pcs[0]) };
  if (pcs.length === 2) {
    const other = pcs.find((p) => p !== bass)!;
    const iv = mod12(other - bass);
    if (iv === 7) return { kind: 'power', root: bass, name: pcName(bass) + '5' };
    if (iv === 5) return { kind: 'power', root: other, name: pcName(other) + '5/' + pcName(bass) };
    return { kind: 'interval', name: `${pcName(bass)} + ${pcName(other)} (${INTERVAL_NAMES[iv]})` };
  }

  type Cand = { chord: Chord; rank: number[] };
  const cands: Cand[] = [];
  for (let root = 0; root < 12; root++) {
    if (!set.has(root)) continue;
    for (const t of CHORD_TYPES) {
      const full = t.intervals.map((i) => mod12(root + i));
      let omitted = 0;
      let match = full.length === set.size && full.every((p) => set.has(p));
      if (!match && OMIT5_OK.has(t.id)) {
        const no5 = full.filter((p) => p !== mod12(root + 7));
        match = no5.length === set.size && no5.every((p) => set.has(p));
        omitted = 1;
      }
      if (!match) continue;
      cands.push({
        chord: { root, type: t.id, ...(bass !== root ? { bass } : {}) },
        rank: [omitted, keyPcs && !keyPcs.has(root) ? 1 : 0, t.complexity, bass === root ? 0 : 1, CHORD_TYPES.indexOf(t)],
      });
    }
  }
  if (cands.length === 0) return { kind: 'notes', name: pcs.map(pcName).join(' ') };
  cands.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
    return 0;
  });
  const chord = cands[0].chord;
  return { kind: 'chord', chord, name: chordName(chord) };
}

/** The chord a detection stands for, if any (a power chord counts as major for suggestions). */
export function detectedChord(d: Detected): Chord | null {
  if (d.kind === 'chord') return d.chord;
  if (d.kind === 'power') return { root: d.root, type: 'maj' };
  return null;
}

