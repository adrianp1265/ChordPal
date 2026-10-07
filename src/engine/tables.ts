import type { Mode } from '../theory/keys';

export type Genre = 'all' | 'pop' | 'folk' | 'jazz' | 'house';
export const GENRES: Genre[] = ['all', 'pop', 'folk', 'jazz', 'house'];

/** One generated table: next-chord probabilities per context. Context "" = overall frequencies. */
export interface Table {
  genre: Genre;
  mode: Mode;
  songs: number;
  source?: string;
  next: Record<string, Record<string, number>>;
}

export interface DataIndex {
  genres: Record<Genre, { songs: number; source: string }>;
}

const cache = new Map<string, Promise<Table | null>>();

export function loadTable(genre: Genre, mode: Mode, base = import.meta.env.BASE_URL): Promise<Table | null> {
  const key = `${genre}-${mode}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`${base}data/${key}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<Table>) : null))
        .catch(() => null),
    );
  }
  return cache.get(key)!;
}

export async function loadIndex(base = import.meta.env.BASE_URL): Promise<DataIndex | null> {
  try {
    const r = await fetch(`${base}data/index.json`);
    return r.ok ? ((await r.json()) as DataIndex) : null;
  } catch {
    return null;
  }
}

/** Blend weights for 3-, 2-, 1-chord context and the overall frequencies. */
export const LAMBDA = [0.5, 0.25, 0.15, 0.1];

/** A genre with fewer songs than this leans on All (half weight at exactly this many). */
export const THIN = 2000;

/**
 * P(x | context) blended over context lengths. Weights of contexts missing from
 * the table go to the shorter ones (renormalised over what exists).
 */
export function blendedP(table: Table, context: string[]): Map<string, number> {
  const parts: { w: number; dist: Record<string, number> }[] = [];
  for (let n = 3; n >= 0; n--) {
    if (n > context.length) continue;
    const ctx = n === 0 ? '' : context.slice(-n).join('|');
    const dist = table.next[ctx];
    if (dist) parts.push({ w: LAMBDA[3 - n], dist });
  }
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  const out = new Map<string, number>();
  for (const { w, dist } of parts) {
    for (const [label, p] of Object.entries(dist)) out.set(label, (out.get(label) ?? 0) + (w / wsum) * p);
  }
  return out;
}

/** The genre's blend mixed with All when the genre has little data. */
export function genreP(genreTable: Table | null, allTable: Table | null, context: string[]): Map<string, number> | null {
  if (!genreTable && !allTable) return null;
  if (!genreTable || genreTable === allTable) return blendedP(allTable!, context);
  const g = blendedP(genreTable, context);
  // Starter lists are not blended: All would drown them in jazz.
  if (!allTable || genreTable.songs >= THIN * 10 || genreTable.source?.includes('starter')) return g;
  const w = genreTable.songs / (genreTable.songs + THIN);
  const a = blendedP(allTable, context);
  const out = new Map<string, number>();
  for (const k of new Set([...g.keys(), ...a.keys()])) out.set(k, w * (g.get(k) ?? 0) + (1 - w) * (a.get(k) ?? 0));
  return out;
}
