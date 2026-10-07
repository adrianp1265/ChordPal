import { chordName } from '../theory/chord';
import { prettyLabel } from '../theory/numerals';
import type { Suggestion } from '../engine/score';
import { SLOT_COLORS } from './colors';
import { MiniKeys } from './MiniKeys';

interface Props { suggestions: Suggestion[]; focus: number; onFocus(i: number): void; onUse(i: number): void }

const pct = (p: number) => (p >= 0.995 ? '99%+' : p >= 0.01 ? `${Math.round(p * 100)}%` : p > 0 ? '<1%' : 'rare');

export function Cards({ suggestions, focus, onFocus, onUse }: Props) {
  return (
    <ol className="cards">
      {suggestions.map((s, i) => {
        const color = SLOT_COLORS[i % SLOT_COLORS.length];
        return (
          <li key={`${s.chord.root}:${s.chord.type}`} className={i === focus ? 'focused' : ''} style={{ borderColor: color }}>
            <button className="card-main" onClick={() => onFocus(i)} title="Hear it">
              <span className="cname">{chordName(s.chord)}</span>
              <span className="cnum">{prettyLabel(s.label)}</span>
              <MiniKeys notes={s.voicing} color={color} />
              <span className="bar" title="How often songs go to this chord next">
                <span style={{ width: `${Math.round(s.phat * 100)}%`, background: color }} />
              </span>
              <span className="common" title="Share of songs that go here next · notes your hand keeps">{pct(s.p)} of songs · {s.shared} kept</span>
            </button>
            <button className="use" onClick={() => onUse(i)} title="Play it and see what comes next (does not add it to the loop)">Go</button>
          </li>
        );
      })}
    </ol>
  );
}
