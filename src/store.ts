import { create } from 'zustand';
import { chordName, chordPcs, defaultVoicing, sameChord, type Chord } from './theory/chord';
import { homeKey, KeyTracker, scalePcs, type Key, type Mode } from './theory/keys';
import { detect, detectedChord, type Detected } from './theory/naming';
import { toLabel } from './theory/numerals';
import type { Mood } from './engine/moods';
import { genreP, loadIndex, loadTable, type DataIndex, type Genre, type Table } from './engine/tables';
import { suggest, type Suggestion } from './engine/score';
import { voiceNear } from './theory/voiceLeading';

export interface TrailItem { chord: Chord; voicing: number[] }
export interface Saved { name: string; at: number; trail: TrailItem[]; bpm: number }

export interface Settings {
  genre: Genre;
  mood: Mood;
  adventure: number; // 0..100
  keyLock: Key | null;
  monitor: boolean;
  bpm: number;
  midiInput: string | null;
}

const SETTINGS_KEY = 'chordpal-settings';
const SAVES_KEY = 'chordpal-saves';

const DEFAULTS: Settings = { genre: 'all', mood: 'none', adventure: 25, keyLock: null, monitor: false, bpm: 90, midiInput: null };

function readJSON<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? { ...fallback, ...JSON.parse(v) } : fallback;
  } catch {
    return fallback;
  }
}
function readSaves(): Saved[] {
  try {
    const v = localStorage.getItem(SAVES_KEY);
    return v ? (JSON.parse(v) as Saved[]) : [];
  } catch {
    return [];
  }
}
function write(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

/** Replay the key tracker over the chords played (deterministic). */
export function keyOf(trail: TrailItem[], lock: Key | null): Key | null {
  if (lock) return lock;
  if (!trail.length) return null;
  const kt = new KeyTracker();
  let k: Key = homeKey(trail[0].chord);
  for (const t of trail.slice(-40)) k = kt.push(t.chord);
  return k;
}

interface State {
  started: boolean;
  settings: Settings;
  held: number[];
  detected: Detected;
  /** The chord suggestions are made for: the last one played or picked. */
  current: Chord | null;
  currentVoicing: number[];
  key: Key | null;
  /** Chords played or picked, newest last (key finding and context). Not the loop. */
  history: TrailItem[];
  /** The loop: only chords the user captured. */
  trail: TrailItem[];
  suggestions: Suggestion[];
  focus: number;
  tables: Partial<Record<string, Table | null>>;
  index: DataIndex | null;
  saves: Saved[];
  playingStep: number | null;
  midi: { supported: boolean; ports: { id: string; name: string }[]; selected: string | null; connected: boolean };

  setStarted(): void;
  set<K extends keyof Settings>(k: K, v: Settings[K]): void;
  setHeld(n: number[]): void;
  /** Held notes settled: name them and, if they make a new chord, add it. */
  settled(n: number[]): void;
  /** Make a chord the current one (suggestions follow it). Does not touch the loop. */
  commit(chord: Chord, voicing?: number[]): void;
  /** Add the current chord to the loop. */
  capture(): void;
  /** Add chords to the loop and make the last one current. */
  captureMany(items: TrailItem[]): void;
  /** Swap one chord of the loop. */
  replaceTrail(i: number, item: TrailItem): void;
  setFocus(i: number): void;
  undo(): void;
  clear(): void;
  save(name: string): void;
  load(i: number): void;
  removeSave(i: number): void;
  setPlaying(i: number | null): void;
  setMidi(m: Partial<State['midi']>): void;
  ensureTables(): Promise<void>;
  recompute(): void;
}

export const useStore = create<State>((set, get) => ({
  started: false,
  settings: readJSON(SETTINGS_KEY, DEFAULTS),
  held: [],
  detected: { kind: 'none', name: '' },
  current: null,
  currentVoicing: [],
  key: null,
  history: [],
  trail: [],
  suggestions: [],
  focus: 0,
  tables: {},
  index: null,
  saves: readSaves(),
  playingStep: null,
  midi: { supported: false, ports: [], selected: null, connected: false },

  setStarted: () => set({ started: true }),

  set: (k, v) => {
    const settings = { ...get().settings, [k]: v };
    write(SETTINGS_KEY, settings);
    set({ settings, ...(k === 'keyLock' ? { key: keyOf(get().history, settings.keyLock) } : {}) });
    if (k === 'genre' || k === 'keyLock') void get().ensureTables();
    get().recompute();
  },

  setHeld: (held) => {
    set({ held });
    // ghost keys follow the hand while it moves
    if (held.length) get().recompute();
  },

  settled: (notes) => {
    const k = get().key;
    const d = detect(notes, k ? scalePcs(k) : undefined);
    set({ detected: d });
    const chord = detectedChord(d);
    if (chord) get().commit(chord, notes);
  },

  commit: (chord, voicing) => {
    const s = get();
    const v = voicing ?? defaultVoicing(chord);
    // Playing the same chord again (any inversion) only updates the hand position.
    if (sameChord(chord, s.current)) {
      set({ currentVoicing: v, detected: { kind: 'chord', chord, name: chordName(chord) } });
      get().recompute();
      return;
    }
    const history = [...s.history, { chord, voicing: v }].slice(-40);
    set({
      history,
      current: chord,
      currentVoicing: v,
      key: keyOf(history, s.settings.keyLock),
      focus: 0,
      detected: { kind: 'chord', chord, name: chordName(chord) },
    });
    void get().ensureTables();
    get().recompute();
  },

  capture: () => {
    const s = get();
    if (!s.current) return;
    set({ trail: [...s.trail, { chord: s.current, voicing: s.currentVoicing.length ? s.currentVoicing : defaultVoicing(s.current) }] });
  },

  captureMany: (items) => {
    for (const it of items) get().commit(it.chord, it.voicing);
    set({ trail: [...get().trail, ...items] });
  },

  replaceTrail: (i, item) => set({ trail: get().trail.map((t, j) => (j === i ? item : t)) }),

  setFocus: (focus) => set({ focus }),

  undo: () => set({ trail: get().trail.slice(0, -1) }),

  clear: () => set({ trail: [] }),

  save: (name) => {
    const saves = [{ name: name || `Progression ${get().saves.length + 1}`, at: Date.now(), trail: get().trail, bpm: get().settings.bpm }, ...get().saves];
    write(SAVES_KEY, saves);
    set({ saves });
  },

  load: (i) => {
    const sv = get().saves[i];
    if (!sv) return;
    const last = sv.trail[sv.trail.length - 1];
    set({
      trail: sv.trail,
      history: sv.trail,
      current: last?.chord ?? null,
      currentVoicing: last?.voicing ?? [],
      key: keyOf(sv.trail, get().settings.keyLock),
      detected: last ? { kind: 'chord', chord: last.chord, name: chordName(last.chord) } : { kind: 'none', name: '' },
    });
    get().set('bpm', sv.bpm);
  },

  removeSave: (i) => {
    const saves = get().saves.filter((_, j) => j !== i);
    write(SAVES_KEY, saves);
    set({ saves });
  },

  setPlaying: (playingStep) => set({ playingStep }),
  setMidi: (m) => set({ midi: { ...get().midi, ...m } }),

  ensureTables: async () => {
    const s = get();
    if (!s.index) loadIndex().then((index) => set({ index }));
    const mode: Mode = s.key?.mode ?? 'major';
    const want = [`${s.settings.genre}-${mode}`, `all-${mode}`];
    const missing = want.filter((k) => !(k in s.tables));
    if (!missing.length) return;
    const loaded = await Promise.all(missing.map((k) => loadTable(k.split('-')[0] as Genre, mode)));
    set({ tables: { ...get().tables, ...Object.fromEntries(missing.map((k, i) => [k, loaded[i]])) } });
    get().recompute();
  },

  recompute: () => {
    const s = get();
    if (!s.current || !s.key) return set({ suggestions: [] });
    const mode = s.key.mode;
    const g = s.tables[`${s.settings.genre}-${mode}`] ?? null;
    const all = s.tables[`all-${mode}`] ?? null;
    const context = s.history.slice(-3).map((t) => toLabel(t.chord, s.key!));
    const p = genreP(g, all, context);
    const held = s.held.length ? s.held : s.currentVoicing.length ? s.currentVoicing : defaultVoicing(s.current);
    const suggestions = suggest({
      current: s.current,
      key: s.key,
      p,
      mood: s.settings.mood,
      adventure: s.settings.adventure / 100,
      held,
    }).map((x) => ({ ...x, voicing: x.voicing.length ? x.voicing : voiceNear(defaultVoicing(s.current!), chordPcs(x.chord)) }));
    set({ suggestions, focus: Math.min(s.focus, Math.max(0, suggestions.length - 1)) });
  },
}));
