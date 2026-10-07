// The 17 chord types of the library. `code` is the suffix used in data tables
// (major = ''), `suffix` the one shown on screen.
export interface ChordType {
  id: TypeId;
  code: string;
  suffix: string;
  intervals: number[];
  /** 0 = triad, 1 = four-note colour, 2 = five-note. Used to prefer simpler names. */
  complexity: number;
  minor: boolean;
}

export type TypeId =
  | 'maj' | 'm' | '7' | 'maj7' | 'm7' | 'sus2' | 'sus4' | 'add9' | '6'
  | 'm6' | '9' | 'maj9' | 'm9' | 'dim' | 'dim7' | 'm7b5' | 'aug';

const t = (id: TypeId, code: string, suffix: string, intervals: number[], complexity: number, minor = false): ChordType =>
  ({ id, code, suffix, intervals, complexity, minor });

export const CHORD_TYPES: ChordType[] = [
  t('maj', '', '', [0, 4, 7], 0),
  t('m', 'm', 'm', [0, 3, 7], 0, true),
  t('7', '7', '7', [0, 4, 7, 10], 1),
  t('maj7', 'maj7', 'maj7', [0, 4, 7, 11], 1),
  t('m7', 'm7', 'm7', [0, 3, 7, 10], 1, true),
  t('sus2', 'sus2', 'sus2', [0, 2, 7], 0),
  t('sus4', 'sus4', 'sus4', [0, 5, 7], 0),
  t('add9', 'add9', 'add9', [0, 2, 4, 7], 1),
  t('6', '6', '6', [0, 4, 7, 9], 1),
  t('m6', 'm6', 'm6', [0, 3, 7, 9], 1, true),
  t('9', '9', '9', [0, 2, 4, 7, 10], 2),
  t('maj9', 'maj9', 'maj9', [0, 2, 4, 7, 11], 2),
  t('m9', 'm9', 'm9', [0, 2, 3, 7, 10], 2, true),
  t('dim', 'dim', 'dim', [0, 3, 6], 0, true),
  t('dim7', 'dim7', 'dim7', [0, 3, 6, 9], 1, true),
  t('m7b5', 'm7b5', 'm7♭5', [0, 3, 6, 10], 1, true),
  t('aug', 'aug', 'aug', [0, 4, 8], 0),
];

export const TYPE_BY_ID = Object.fromEntries(CHORD_TYPES.map((c) => [c.id, c])) as Record<TypeId, ChordType>;
export const TYPE_BY_CODE = Object.fromEntries(CHORD_TYPES.map((c) => [c.code, c])) as Record<string, ChordType>;
