import type { Chord } from '../theory/chord';
import type { Key } from '../theory/keys';
import { fromLabel, toLabel } from '../theory/numerals';
import { simplify } from './standards';

/** loops-<genre>-<mode>.json: songs containing each 3- and 4-chord run. */
export interface LoopFile { songs: number; loops: Record<string, [string, number][]> }

export interface CountedLoop { labels: string[]; chords: Chord[]; songs: number; share: number }

/**
 * The runs of `length` chords real songs most often play starting from your
 * chord (as its number in the key). Counted per song, so `share` is the share
 * of songs that contain the run at least once.
 */
export function loopsFrom(chord: Chord, key: Key, file: LoopFile | null, length: 3 | 4, count = 8): CountedLoop[] {
  if (!file) return [];
  const start = simplify(toLabel(chord, key));
  const rows = (file.loops[String(length)] ?? [])
    .map(([s, n]) => ({ labels: s.split('|'), songs: n }))
    .filter((r) => r.labels[0] === start && (length < 4 || new Set(r.labels).size >= 3))
    .sort((a, b) => b.songs - a.songs)
    .slice(0, count);
  return rows.map((r) => ({
    labels: [toLabel(chord, key), ...r.labels.slice(1)],
    chords: [chord, ...r.labels.slice(1).map((l) => fromLabel(l, key)!)],
    songs: r.songs,
    share: file.songs ? r.songs / file.songs : 0,
  }));
}
