import moods from './moods.json';
import type { TypeId } from '../theory/chordTypes';

export type Mood = 'none' | 'bright' | 'dark' | 'dreamy' | 'tense';
export const MOODS: Mood[] = ['none', 'bright', 'dark', 'dreamy', 'tense'];
export const BOOST = 1.3;
export const DAMP = 0.7;

const table = moods as Record<Mood, { boost?: string[]; damp?: string[] }>;

export function moodWeight(mood: Mood, type: TypeId): number {
  const m = table[mood];
  if (m.boost?.includes(type)) return BOOST;
  if (m.damp?.includes(type)) return DAMP;
  return 1;
}
