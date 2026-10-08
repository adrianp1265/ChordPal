import { useState } from 'react';
import { chordName } from '../theory/chord';
import { keyName } from '../theory/keys';
import { useStore } from '../store';
import { useData } from '../engine/data';
import { loopsFrom, type LoopFile } from '../engine/loops';
import { standardsWith, type StandardStats } from '../engine/standards';
import { ProgressionRow } from './ProgressionRow';
import { pct } from './format';
import { Examples } from './Standards';

/** After the chord you play: famous progressions it can start, then the runs real songs play most. */
export function Progressions() {
  const { current, currentVoicing, key, settings } = useStore();
  const [length, setLength] = useState<3 | 4>(4);
  const [moreFamous, setMoreFamous] = useState(false);
  const [moreCounted, setMoreCounted] = useState(false);
  const stats = useData<StandardStats>('standards-stats.json');
  const loops = useData<LoopFile>(key ? `loops-${settings.genre}-${key.mode}.json` : null);

  if (!current || !key) return <p className="hint pad">Play a chord to see the progressions that start with it.</p>;
  const genre = settings.genre === 'all' ? '' : `${settings.genre} `;
  const famous = standardsWith(current, stats, settings.genre);
  const counted = loopsFrom(current, key, loops, length);

  return (
    <div className="progs">
      <h3>Famous progressions that start on {chordName(current)}</h3>
      <p className="muted small">Tap any chord to hear it and see what else fits there.</p>
      <ol>
        {(moreFamous ? famous : famous.slice(0, 5)).map((p) => (
          <ProgressionRow key={p.standard.id} chords={p.chords} keyNow={p.key} loop={p.standard.loop} startVoicing={currentVoicing}
            title={p.standard.name} subtitle={[p.standard.aka, `in ${keyName(p.key)}`].filter(Boolean).join(' · ')}
            badge={p.share !== null ? `${pct(p.share)} of ${genre}songs` : undefined}
            badgeTitle="Share of songs that contain this progression (any key)"
            footer={<Examples st={p.standard} />} />
        ))}
      </ol>
      {famous.length > 5 && (
        <button className="more" onClick={() => setMoreFamous(!moreFamous)}>{moreFamous ? 'Show fewer' : `Show all ${famous.length}`}</button>
      )}

      <div className="progs-head">
        <h3>Most played in real {genre}songs, starting on {chordName(current)}</h3>
        <label>
          Length
          <select value={length} onChange={(e) => setLength(Number(e.target.value) as 3 | 4)}>
            <option value={3}>3 chords</option>
            <option value={4}>4 chords</option>
          </select>
        </label>
      </div>
      <p className="muted small">In {keyName(key)}. Counted across {loops ? loops.songs.toLocaleString() : '…'} songs: how many contain each run at least once.</p>
      {!loops && <p className="hint">Loading song data…</p>}
      <ol>
        {(moreCounted ? counted : counted.slice(0, 5)).map((r) => (
          <ProgressionRow key={r.labels.join('|')} chords={r.chords} keyNow={key} startVoicing={currentVoicing}
            badge={`${pct(r.share)} of songs`} badgeTitle={`${r.songs.toLocaleString()} songs contain this run`} />
        ))}
      </ol>
      {counted.length > 5 && (
        <button className="more" onClick={() => setMoreCounted(!moreCounted)}>{moreCounted ? 'Show fewer' : `Show ${counted.length - 5} more`}</button>
      )}
    </div>
  );
}
