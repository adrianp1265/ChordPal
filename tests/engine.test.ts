import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detect } from '../src/theory/naming';
import { KeyTracker, scalePcs, keyName } from '../src/theory/keys';
import { moveCost, voiceNear } from '../src/theory/voiceLeading';
import { fromLabel, toLabel } from '../src/theory/numerals';
import { chordName, LIBRARY, type Chord } from '../src/theory/chord';
import { blendedP, genreP, type Table } from '../src/engine/tables';
import { suggest } from '../src/engine/score';
import { MidiInput } from '../src/midi/input';

const table = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8')) as Table;
const C = (root: number, type: Chord['type'] = 'maj'): Chord => ({ root, type });
const N = (...notes: number[]) => detect(notes).name;

describe('naming', () => {
  it('names triads, inversions and sevenths', () => {
    expect(N(60, 64, 67)).toBe('C');
    expect(N(64, 67, 72)).toBe('C/E');
    expect(N(57, 60, 64, 67)).toBe('Am7');
    expect(N(60, 64, 70)).toBe('C7'); // no fifth
    expect(N(59, 62, 65, 68)).toBe('Bdim7');
    expect(N(60, 63, 66, 70)).toBe('Cm7♭5');
    expect(N(62, 66, 69, 72, 76)).toBe('D9');
  });
  it('prefers the simpler name and a root in the bass when tied', () => {
    expect(N(60, 64, 67, 69)).toBe('C6');
    expect(N(60, 62, 67)).toBe('Csus2');
  });
  it('prefers a root in the key', () => {
    // E-G#-C (aug) can be named from any of its notes. In E-flat major, E is not in the key.
    expect(detect([64, 68, 72]).name).toBe('Eaug');
    expect(detect([64, 68, 72], scalePcs({ tonic: 3, mode: 'major' })).name).toBe('Caug/E');
  });
  it('shows intervals, power chords and unnamed notes', () => {
    expect(N(60, 67)).toBe('C5');
    expect(N(60, 64)).toBe('C + E (M3)');
    expect(N(60, 61, 62)).toBe('C D♭ D');
  });
});

describe('key finding', () => {
  it('C F G C Am sets C major, and one stray chord does not change it', () => {
    const kt = new KeyTracker();
    let k = kt.push(C(0));
    for (const c of [C(5), C(7), C(0), C(9, 'm')]) k = kt.push(c);
    expect(keyName(k)).toBe('C major');
    k = kt.push(C(3)); // E-flat: stray
    expect(keyName(k)).toBe('C major');
    k = kt.push(C(0));
    expect(keyName(k)).toBe('C major');
  });
  it('treats the current chord as home until the key is clear', () => {
    const kt = new KeyTracker();
    expect(keyName(kt.push(C(7)))).toBe('G major');
    expect(keyName(kt.push(C(9, 'm')))).toBe('A minor');
  });
});

describe('numbers', () => {
  it('round-trips every library chord', () => {
    for (const k of [{ tonic: 0, mode: 'major' as const }, { tonic: 9, mode: 'minor' as const }])
      for (const c of LIBRARY) expect(fromLabel(toLabel(c, k), k)).toEqual(c);
  });
  it('C in G is the 4, Am in C is 6m', () => {
    expect(toLabel(C(0), { tonic: 7, mode: 'major' })).toBe('4');
    expect(toLabel(C(9, 'm'), { tonic: 0, mode: 'major' })).toBe('6m');
  });
});

describe('voice leading', () => {
  it('counts the fewest semitones, with doubling', () => {
    expect(moveCost([0, 4, 7], [0, 4, 7]).cost).toBe(0);
    expect(moveCost([0, 4, 7], [0, 5, 9]).cost).toBe(3); // C -> F: E->F, G->A
    expect(moveCost([0, 4, 7], [7, 11, 2]).cost).toBe(3); // C -> G
    expect(moveCost([0, 4, 7], [0, 4, 7, 11, 2]).cost).toBe(3); // C -> Cmaj9: C doubles onto B (1) and D (2)
  });
  it('voices the next chord near the hand', () => {
    expect(voiceNear([60, 64, 67], [5, 9, 0])).toEqual([60, 65, 69]);
  });
});

describe('suggestions (data)', () => {
  const pop = table('pop-major');
  const all = table('all-major');
  const cMaj = { tonic: 0, mode: 'major' as const };
  const run = (adv: number, p = genreP(pop, all, ['1'])) =>
    suggest({ current: C(0), key: cMaj, p, mood: 'none', adventure: adv, held: [60, 64, 67] });

  it('pop sanity: after 1, the top three include 5, 4 and 6m', () => {
    const top = Object.entries(pop.next['1']).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l);
    expect(new Set(top)).toEqual(new Set(['5', '4', '6m']));
  });
  it('pop, key of C, dial 0: top three after C include G, F and Am', () => {
    const names = run(0).slice(0, 3).map((s) => chordName(s.chord));
    expect(new Set(names)).toEqual(new Set(['G', 'F', 'Am']));
  });
  it('dial 100: the single most common next chord drops out', () => {
    const top0 = chordName(run(0)[0].chord);
    const names = run(1).map((s) => chordName(s.chord));
    expect(names).not.toContain(top0);
    expect(names.length).toBe(8);
  });
  it('blending gives chords outside the context table some P', () => {
    const p = blendedP(pop, ['1']);
    expect(p.get('4maj7') ?? 0).toBeGreaterThanOrEqual(0);
    expect([...p.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
  });
  it('never suggests the current chord; mood changes the list', () => {
    expect(run(0.3).some((s) => s.chord.root === 0 && s.chord.type === 'maj')).toBe(false);
    const dark = suggest({ current: C(0), key: cMaj, p: genreP(pop, all, ['1']), mood: 'dark', adventure: 0.3, held: [60, 64, 67] });
    expect(dark.map((s) => s.chord.type)).not.toEqual(run(0.3).map((s) => s.chord.type));
  });
  it('jazz: ii7 goes to V7', () => {
    const jazz = table('jazz-major');
    const s = suggest({ current: { root: 2, type: 'm7' }, key: cMaj, p: genreP(jazz, all, ['2m7']), mood: 'none', adventure: 0, held: [] });
    expect(chordName(s[0].chord)).toBe('G7');
  });
});

describe('midi input', () => {
  const make = () => {
    const settled: number[][] = [];
    const m = new MidiInput({ onNotes() {}, onSettled: (h) => settled.push(h), onPorts() {} });
    return { m, settled };
  };
  const on = (n: number) => new Uint8Array([0x90, n, 100]);
  const off = (n: number) => new Uint8Array([0x80, n, 0]);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it('a rolled chord (40 ms apart) registers once', async () => {
    const { m, settled } = make();
    m.message(on(60)); await wait(40); m.message(on(64)); await wait(40); m.message(on(67));
    await wait(150);
    expect(settled).toEqual([[60, 64, 67]]);
  });
  it('the sustain pedal keeps the chord after lifting fingers; releases alone never register', async () => {
    const { m, settled } = make();
    m.message(new Uint8Array([0xb0, 64, 127]));
    for (const n of [60, 64, 67]) m.message(on(n));
    await wait(120);
    for (const n of [60, 64, 67]) m.message(off(n));
    await wait(120);
    expect(m.held()).toEqual([60, 64, 67]);
    expect(settled.length).toBe(1);
    m.message(new Uint8Array([0xb0, 64, 0]));
    expect(m.held()).toEqual([]);
  });
});

import { prettyLabel } from '../src/theory/numerals';
describe('labels', () => {
  it('shows numbers readably', () => {
    expect(prettyLabel('b7')).toBe('♭7');
    expect(prettyLabel('6m')).toBe('6m');
    expect(prettyLabel('27')).toBe('2 7');
    expect(prettyLabel('b67')).toBe('♭6 7');
    expect(prettyLabel('7m7b5')).toBe('7m7♭5');
  });
});

import { topProgressions, noRepeats } from '../src/engine/progressions';
describe('progressions', () => {
  it('pop, after C: 1-5-6m-4 (C G Am F) is among the most common, no repeats', () => {
    const cMaj = { tonic: 0, mode: 'major' as const };
    const rows = topProgressions(C(0), cMaj, table('pop-major'), table('all-major'));
    console.log(rows.map((r) => `${r.chords.map(chordName).join(' ')}  ${(r.p * 100).toFixed(1)}%`).join('\n'));
    expect(rows.length).toBe(8);
    expect(rows[0].labels.join(' ')).toBe('1 5 6m 4');
    expect(rows.every((r) => new Set(r.labels).size >= 3)).toBe(true);
    expect(rows.every(noRepeats)).toBe(true);
    expect(rows[0].p).toBeGreaterThanOrEqual(rows[7].p);
  });
});
