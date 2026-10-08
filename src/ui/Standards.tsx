import { useState } from 'react';
import { PC_NAMES } from '../theory/pitch';
import { keyName, type Key } from '../theory/keys';
import { prettyLabel } from '../theory/numerals';
import { useStore } from '../store';
import { useData } from '../engine/data';
import { place, STANDARDS, type Standard, type StandardStats } from '../engine/standards';
import { ProgressionRow } from './ProgressionRow';
import { pct } from './format';

export function Examples({ st }: { st: Standard }) {
  return (
    <p className="examples">
      {st.about}{' '}
      <span className="muted">
        Heard in: {st.examples.map((e) => `${e.song} (${e.artist})${e.from && e.from !== st.labels[0] ? `, starting on the ${prettyLabel(e.from)}` : ''}`).join(' · ')}
      </span>
    </p>
  );
}

/** The named progressions, written out in any key, ranked by how many songs use them. */
export function Standards() {
  const { key, settings } = useStore();
  // Major key to show; minor standards use its relative minor.
  const [tonic, setTonic] = useState(() => (key ? (key.mode === 'major' ? key.tonic : (key.tonic + 3) % 12) : 0));
  const stats = useData<StandardStats>('standards-stats.json');
  const genre = settings.genre === 'all' ? '' : `${settings.genre} `;
  const rows = STANDARDS.map((st) => {
    const k: Key = st.mode === 'major' ? { tonic, mode: 'major' } : { tonic: (tonic + 9) % 12, mode: 'minor' };
    return place(st, k, 0, stats, settings.genre);
  }).sort((a, b) => (b.share ?? 0) - (a.share ?? 0));

  return (
    <div className="progs">
      <div className="progs-head">
        <h3>Standard progressions</h3>
        <label>
          Key
          <select value={tonic} onChange={(e) => setTonic(Number(e.target.value))}>
            {PC_NAMES.map((n, t) => <option key={n} value={t}>{n} major / {keyName({ tonic: (t + 9) % 12, mode: 'minor' })}</option>)}
          </select>
        </label>
      </div>
      <p className="muted small">The progressions most songs are built on, most used first. Learn them as numbers and they work in every key.</p>
      <ol>
        {rows.map((p) => (
          <ProgressionRow key={p.standard.id + p.key.tonic} chords={p.chords} keyNow={p.key} loop={p.standard.loop}
            title={p.standard.name} subtitle={`${p.standard.aka} · ${keyName(p.key)}`}
            badge={p.share !== null ? `${pct(p.share)} of ${genre}songs` : undefined}
            badgeTitle="Share of songs that contain this progression (any key)"
            footer={<Examples st={p.standard} />} />
        ))}
      </ol>
    </div>
  );
}
