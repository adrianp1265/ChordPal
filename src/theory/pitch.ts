// Pitch classes 0-11 (C = 0). Names use the common mixed spelling.
export const PC_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const mod12 = (n: number) => ((n % 12) + 12) % 12;
export const pcName = (pc: number) => PC_NAMES[mod12(pc)];

/** Shortest distance between two pitch classes, 0..6. */
export const pcDist = (a: number, b: number) => {
  const d = mod12(a - b);
  return Math.min(d, 12 - d);
};

/** Signed shortest move from pitch class a to b, -5..6. */
export const pcStep = (a: number, b: number) => {
  const d = mod12(b - a);
  return d > 6 ? d - 12 : d;
};

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Parse "C", "Db", "F#", "Fs" (Chordonomicon), "D♭". Returns null if not a note. */
export function parsePc(s: string): number | null {
  const m = /^([A-Ga-g])([#s♯b♭]*)$/.exec(s);
  if (!m) return null;
  let pc = LETTER[m[1].toUpperCase()];
  for (const ch of m[2]) pc += ch === 'b' || ch === '♭' ? -1 : 1;
  return mod12(pc);
}

export const midiName = (n: number) => `${pcName(n)}${Math.floor(n / 12) - 1}`;
