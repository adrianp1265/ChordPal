import { GENRES, type Genre } from '../engine/tables';
import { MOODS, type Mood } from '../engine/moods';
import { keyName, type Key, type Mode } from '../theory/keys';
import { PC_NAMES } from '../theory/pitch';
import { useStore } from '../store';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Props { open: boolean; onSelectMidi(id: string): void }

export function Controls({ open, onSelectMidi }: Props) {
  const { settings, set, key, index, midi } = useStore();
  const lock = settings.keyLock;
  const source = index?.genres[settings.genre]?.source ?? '';

  const setKey = (v: string) => {
    if (v === 'auto') return set('keyLock', null);
    if (v === 'lock' && key) return set('keyLock', key);
    const [t, m] = v.split(':');
    set('keyLock', { tonic: Number(t), mode: m as Mode });
  };

  return (
    <div className={'controls' + (open ? ' open' : '')}>
      <label title="Auto follows what you play. Pick one to keep the numbers fixed.">
        Key
        <select value={lock ? `${lock.tonic}:${lock.mode}` : 'auto'} onChange={(e) => setKey(e.target.value)}>
          <option value="auto">Auto{!lock && key ? ` (${keyName(key)})` : ''}</option>
          {key && !lock && <option value="lock">Lock {keyName(key)}</option>}
          {(['major', 'minor'] as Mode[]).flatMap((m) =>
            PC_NAMES.map((_, t) => <option key={`${t}:${m}`} value={`${t}:${m}`}>{keyName({ tonic: t, mode: m } as Key)}</option>),
          )}
        </select>
      </label>
      <label title="Which songs the suggestions are learned from">
        Genre
        <select value={settings.genre} onChange={(e) => set('genre', e.target.value as Genre)}>
          {GENRES.map((g) => <option key={g} value={g}>{cap(g)}</option>)}
        </select>
        {source.includes('starter') && <span className="tag" title="Starter progressions until the Chordonomicon tables are built">starter data</span>}
      </label>
      <label title="Nudges suggestions toward chords with this feel">
        Mood
        <select value={settings.mood} onChange={(e) => set('mood', e.target.value as Mood)}>
          {MOODS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
        </select>
      </label>
      <label className="adventure" title="Low: the moves most songs make. High: rarer, more surprising ones.">
        Adventure <output>{settings.adventure}</output>
        <input type="range" min={0} max={100} value={settings.adventure} onChange={(e) => set('adventure', Number(e.target.value))} />
      </label>
      <label>
        MIDI
        {midi.supported ? (
          <select value={midi.selected ?? ''} onChange={(e) => onSelectMidi(e.target.value)}>
            {midi.ports.length === 0 && <option value="">No keyboard found</option>}
            {midi.ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <span className="tag">not available in this browser</span>
        )}
      </label>
      <label className="check" title="Play the piano sound when you press keys on your MIDI keyboard">
        <input type="checkbox" checked={settings.monitor} onChange={(e) => set('monitor', e.target.checked)} />
        Monitor
      </label>
    </div>
  );
}
