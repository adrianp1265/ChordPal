import { CHORD_TYPES } from '../theory/chordTypes';
import { chordName, chordPcs, sameChord, type Chord } from '../theory/chord';
import { scalePcs, type Key } from '../theory/keys';
import { PC_NAMES } from '../theory/pitch';
import { prettyLabel, toLabel } from '../theory/numerals';

interface Props { keyNow: Key | null; current: Chord | null; onPick(c: Chord): void }

/** 12 roots x 17 types. With a key, its chords are highlighted and show their number. */
export function Library({ keyNow, current, onPick }: Props) {
  const scale = keyNow ? scalePcs(keyNow) : null;
  return (
    <div className="library" role="grid" aria-label="Chord library">
      <div className="lib-row lib-head">
        <span />
        {PC_NAMES.map((n) => <span key={n}>{n}</span>)}
      </div>
      {CHORD_TYPES.map((t) => (
        <div key={t.id} className="lib-row">
          <span className="lib-type">{t.suffix || 'maj'}</span>
          {PC_NAMES.map((_, root) => {
            const c: Chord = { root, type: t.id };
            const inKey = !!scale && chordPcs(c).every((p) => scale.has(p));
            return (
              <button
                key={root}
                className={'lib-cell' + (inKey ? ' in-key' : '') + (sameChord(c, current) ? ' current' : '')}
                onClick={() => onPick(c)}
                title={chordName(c)}
              >
                {chordName(c)}
                {inKey && <small>{prettyLabel(toLabel(c, keyNow!))}</small>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
