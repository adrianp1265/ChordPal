import { useState } from 'react';
import { chordName } from '../theory/chord';
import { useStore } from '../store';
import { playLoop, stopLoop } from '../audio/piano';

export function Trail() {
  const { trail, settings, set, undo, clear, save, saves, load, removeSave, playingStep, setPlaying } = useStore();
  const [playing, setPlayingFlag] = useState(false);
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
        {trail.length === 0 && <span className="hint">Your progression appears here.</span>}
        {trail.map((t, i) => (
          <span key={i} className={'chip' + (playingStep === i ? ' playing' : '')}>{chordName(t.chord)}</span>
        ))}
      </div>
      <div className="trail-actions">
        <button onClick={toggle} disabled={!trail.length && !playing}>{playing ? 'Stop' : 'Loop'}</button>
        <label className="bpm">
          <input type="number" min={40} max={220} value={settings.bpm} onChange={(e) => set('bpm', Math.max(40, Math.min(220, Number(e.target.value) || 90)))} /> bpm
        </label>
        <button onClick={undo} disabled={!trail.length}>Undo</button>
        <button onClick={() => { stopLoop(); setPlayingFlag(false); setPlaying(null); clear(); }} disabled={!trail.length}>Clear</button>
        <button onClick={() => { const n = prompt('Name this progression', ''); if (n !== null) save(n); }} disabled={!trail.length}>Save</button>
        <button onClick={() => setShowSaves((v) => !v)}>Saved ({saves.length})</button>
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
