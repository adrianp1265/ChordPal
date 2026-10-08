import { useState } from 'react';
import { chordName, chordPcs } from '../theory/chord';
import { prettyLabel } from '../theory/numerals';
import { voiceNear } from '../theory/voiceLeading';
import { substitutes } from '../engine/subs';
import { playChord } from '../audio/piano';
import { pct } from './format';
import { useStore } from '../store';
import { playLoop, stopLoop } from '../audio/piano';

export function Trail() {
  const { trail, settings, set, undo, clear, save, saves, load, removeSave, playingStep, setPlaying, key, tables, replaceTrail } = useStore();
  const [playing, setPlayingFlag] = useState(false);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const n = trail.length;
  const subs = swapAt !== null && swapAt < n && key
    ? substitutes(trail[(swapAt - 1 + n) % n].chord, trail[swapAt].chord, trail[(swapAt + 1) % n].chord, key,
        tables[`${settings.genre}-${key.mode}`] ?? null, tables[`all-${key.mode}`] ?? null)
    : [];
  const [showSaves, setShowSaves] = useState(false);

  const toggle = () => {
    if (playing) {
      stopLoop();
      setPlaying(null);
      setPlayingFlag(false);
    } else if (trail.length) {
      playLoop(trail.map((t) => t.voicing), settings.bpm, (i) => setPlaying(i));
      setPlayingFlag(true);
    }
  };

  return (
    <div className="trail">
      <div className="trail-chords" aria-label="Progression">
        <b className="trail-title">Your loop</b>
        {trail.length === 0 && <span className="hint">Empty. Play a chord and press Capture (or Space) to add it.</span>}
        {trail.map((t, i) => (
          <button key={i} className={'chip' + (playingStep === i ? ' playing' : '') + (swapAt === i ? ' swapping' : '')}
            onClick={() => { playChord(t.voicing); setSwapAt(swapAt === i ? null : i); }} title="Hear it and swap it">
            {chordName(t.chord)}
          </button>
        ))}
        {trail.length > 0 && swapAt === null && <span className="hint small-hint">Tap a chord to swap it.</span>}
      </div>
      {swapAt !== null && swapAt < n && (
        <div className="swap">
          <span className="muted">Instead of {chordName(trail[swapAt].chord)} here, songs often use:</span>
          <div className="swap-list">
            {subs.length === 0 && <span className="muted">Nothing common here.</span>}
            {subs.map((s) => (
              <button key={s.label} onClick={() => {
                const voicing = voiceNear(trail[swapAt].voicing, chordPcs(s.chord));
                replaceTrail(swapAt, { chord: s.chord, voicing });
                playChord(voicing);
              }}>
                <b>{chordName(s.chord)}</b> <span className="muted">{prettyLabel(s.label)} · {pct(s.p)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="trail-actions">
        <button onClick={toggle} disabled={!trail.length && !playing}>{playing ? '■ Stop' : '▶ Play loop'}</button>
        <label className="bpm">
          <input type="number" min={40} max={220} value={settings.bpm} onChange={(e) => set('bpm', Math.max(40, Math.min(220, Number(e.target.value) || 90)))} /> bpm
        </label>
        <button onClick={() => { setSwapAt(null); undo(); }} disabled={!trail.length}>Undo</button>
        <button onClick={() => { stopLoop(); setPlayingFlag(false); setPlaying(null); setSwapAt(null); clear(); }} disabled={!trail.length}>Clear</button>
        <button onClick={() => { const n = prompt('Name this progression', ''); if (n !== null) save(n); }} disabled={!trail.length}>Save</button>
        <button onClick={() => setShowSaves((v) => !v)}>{showSaves ? 'Hide saved' : `Saved (${saves.length})`}</button>
      </div>
      {showSaves && (
        <ul className="saves">
          {saves.length === 0 && <li className="hint">Nothing saved yet.</li>}
          {saves.map((s, i) => (
            <li key={s.at}>
              <button onClick={() => { load(i); setShowSaves(false); }}>{s.name}</button>
              <span>{s.trail.map((t) => chordName(t.chord)).join(' – ')}</span>
              <button className="x" onClick={() => removeSave(i)} aria-label={`Delete ${s.name}`}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
