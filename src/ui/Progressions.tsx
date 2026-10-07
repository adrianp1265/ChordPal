import { useMemo, useState } from 'react';
import { chordName, chordPcs, defaultVoicing } from '../theory/chord';
import { prettyLabel } from '../theory/numerals';
import { voiceNear } from '../theory/voiceLeading';
import { topProgressions } from '../engine/progressions';
import { playSequence } from '../audio/piano';
import { useStore } from '../store';
import { SLOT_COLORS } from './colors';
import { MiniKeys } from './MiniKeys';

const pct = (p: number) => (p >= 0.01 ? `${Math.round(p * 100)}%` : '<1%');

/** After the chord you play: the most common 4-chord ways songs continue. */
export function Progressions() {
  const { current, currentVoicing, key, tables, settings, commit } = useStore();
  const [playing, setPlaying] = useState<{ row: number; step: number } | null>(null);
  const [length, setLength] = useState(4);

  const rows = useMemo(() => {
    if (!current || !key) return [];
    const g = tables[`${settings.genre}-${key.mode}`] ?? null;
    const all = tables[`all-${key.mode}`] ?? null;
    const start = currentVoicing.length ? currentVoicing : defaultVoicing(current);
    return topProgressions(current, key, g, all, { length }).map((pr) => {
      // voice each chord close to the one before, starting from your hand
      const voicings = [start];
      for (const c of pr.chords.slice(1)) voicings.push(voiceNear(voicings[voicings.length - 1], chordPcs(c)));
      return { ...pr, voicings };
    });
  }, [current, currentVoicing, key, tables, settings.genre, length]);

  if (!current) return <p className="hint pad">Play a chord to see the progressions songs most often follow from it.</p>;

  const play = (i: number) => playSequence(rows[i].voicings, settings.bpm, (step) => setPlaying(step < 0 ? null : { row: i, step }));
  const use = (i: number) => rows[i].chords.slice(1).forEach((c, j) => commit(c, rows[i].voicings[j + 1]));

  return (
    <div className="progs">
      <div className="progs-head">
        <span>After <b>{chordName(current)}</b>, songs most often go:</span>
        <label>
          Length
          <select value={length} onChange={(e) => setLength(Number(e.target.value))}>
            {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} chords</option>)}
          </select>
        </label>
      </div>
      {rows.length === 0 && <p className="hint">Loading song data…</p>}
      <ol>
        {rows.map((r, i) => (
          <li key={r.labels.join('|')} className="prog">
            <div className="prog-chords">
              {r.chords.map((c, j) => (
                <div key={j} className={'prog-chord' + (playing?.row === i && playing.step === j ? ' playing' : '')}>
                  <span className="pc-name">{chordName(c)}</span>
                  <span className="pc-num">{prettyLabel(r.labels[j])}</span>
                  <MiniKeys notes={r.voicings[j]} color={SLOT_COLORS[j % SLOT_COLORS.length]} label={false} />
                </div>
              ))}
            </div>
            <div className="prog-side">
              <span className="prog-p" title="Share of songs that continue this way after the first chord">{pct(r.p)}</span>
              <button onClick={() => play(i)} aria-label={`Play ${r.chords.map(chordName).join(' ')}`}>▶ Play</button>
              <button onClick={() => use(i)}>Use</button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
