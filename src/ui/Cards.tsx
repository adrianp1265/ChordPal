import { chordName } from '../theory/chord';
import { prettyLabel } from '../theory/numerals';
import type { Suggestion } from '../engine/score';
import { SLOT_COLORS } from './colors';

interface Props { suggestions: Suggestion[]; focus: number; onFocus(i: number): void; onUse(i: number): void }

export function Cards({ suggestions, focus, onFocus, onUse }: Props) {
  return (
    <ol className="cards">
      {suggestions.map((s, i) => (
        <li key={`${s.chord.root}:${s.chord.type}`} className={i === focus ? 'focused' : ''} style={{ borderColor: SLOT_COLORS[i % SLOT_COLORS.length] }}>
          <button className="card-main" onClick={() => onFocus(i)} title="Hear it">
            <span className="cname">{chordName(s.chord)}</span>
            <span className="cnum">{prettyLabel(s.label)}</span>
            <span className="bar" title={`How common: ${Math.round(s.phat * 100)}%`}>
              <span style={{ width: `${Math.round(s.phat * 100)}%`, background: SLOT_COLORS[i % SLOT_COLORS.length] }} />
            </span>
            <span className="shared">{s.shared} shared</span>
          </button>
          <button className="use" onClick={() => onUse(i)}>Use</button>
        </li>
      ))}
    </ol>
  );
}
