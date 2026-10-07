import { useCallback, useEffect, useState } from 'react';
import { useStore } from './store';
import { MidiInput } from './midi/input';
import { noteOff, noteOn, playChord, startAudio } from './audio/piano';
import { chordPcs, defaultVoicing, type Chord } from './theory/chord';
import { keyName } from './theory/keys';
import { prettyLabel, toLabel } from './theory/numerals';
import { voiceNear } from './theory/voiceLeading';
import { Controls } from './ui/Controls';
import { MapView } from './ui/MapView';
import { Cards } from './ui/Cards';
import { Library } from './ui/Library';
import { Keyboard } from './ui/Keyboard';
import { Trail } from './ui/Trail';
import { Progressions } from './ui/Progressions';
import { SLOT_COLORS } from './ui/colors';

const midi = new MidiInput({
  onNotes: (held) => useStore.getState().setHeld(held),
  onNoteOn: (n, v) => { if (useStore.getState().settings.monitor) noteOn(n, v); },
  onNoteOff: (n) => { if (useStore.getState().settings.monitor) noteOff(n); },
  onSettled: (held) => useStore.getState().settled(held),
  onPorts: (ports, selected, connected) => useStore.getState().setMidi({ ports, selected, connected }),
});

// Test hook (used by the browser checks).
(window as unknown as { __chordpal: unknown }).__chordpal = { midi, store: useStore };

export default function App() {
  const s = useStore();
  const [view, setView] = useState<'map' | 'library' | 'progressions'>('map');
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setLoading(true);
    await startAudio();
    useStore.getState().setMidi({ supported: midi.supported });
    // MIDI connects in the background: a pending permission prompt must not block the app.
    void midi.start(useStore.getState().settings.midiInput);
    s.setStarted();
    setLoading(false);
  };

  const selectMidi = (id: string) => {
    s.set('midiInput', id);
    midi.select(id);
  };

  const focus = useCallback((i: number) => {
    const sug = useStore.getState().suggestions[i];
    useStore.getState().setFocus(i);
    if (sug) playChord(sug.voicing);
  }, []);

  const go = useCallback((i: number) => {
    const sug = useStore.getState().suggestions[i];
    if (!sug) return;
    playChord(sug.voicing);
    useStore.getState().commit(sug.chord, sug.voicing);
  }, []);

  const pick = (c: Chord) => {
    const from = s.held.length ? s.held : s.currentVoicing;
    const v = from.length ? voiceNear(from, chordPcs(c)) : defaultVoicing(c);
    playChord(v);
    s.commit(c, v);
  };

  // number keys 1-8 focus a suggestion, Enter uses it
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (/^[1-8]$/.test(e.key)) focus(Number(e.key) - 1);
      if (e.key === 'Enter') go(useStore.getState().focus);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [focus, go]);

  if (!s.started) {
    return (
      <main className="start">
        <h1>ChordPal</h1>
        <p>Play a chord. See what comes next.</p>
        <button className="big" onClick={start} disabled={loading}>{loading ? 'Loading piano…' : 'Tap to start'}</button>
      </main>
    );
  }

  const ghost = s.suggestions[s.focus]?.voicing ?? [];
  const showName = s.held.length ? s.detected.name : s.current ? s.detected.name : '';

  return (
    <main className="app">
      <header>
        <h1>ChordPal</h1>
        <Controls onSelectMidi={selectMidi} />
      </header>

      <section className="now">
        <div className="now-name" aria-live="polite">{showName || '—'}</div>
        <div className="now-meta">
          {s.key && <span>{keyName(s.key)}{s.settings.keyLock ? ' (locked)' : ''}</span>}
          {s.current && s.key && <span className="num">{prettyLabel(toLabel(s.current, s.key))}</span>}
          {s.midi.supported && !s.midi.connected && <span className="warn">No MIDI keyboard connected</span>}
        </div>
      </section>

      <section className="middle">
        <div className="pane">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={view === 'map'} onClick={() => setView('map')}>Map</button>
            <button role="tab" aria-selected={view === 'progressions'} onClick={() => setView('progressions')}>Progressions</button>
            <button role="tab" aria-selected={view === 'library'} onClick={() => setView('library')}>Library</button>
          </div>
          {view === 'map' && <MapView current={s.current} keyNow={s.key} suggestions={s.suggestions} focus={s.focus} onFocus={focus} onGo={go} />}
          {view === 'progressions' && <Progressions />}
          {view === 'library' && <Library keyNow={s.key} current={s.current} onPick={pick} />}
        </div>
        <Cards suggestions={s.suggestions} focus={s.focus} onFocus={focus} onUse={go} />
      </section>

      <Trail />
      <Keyboard held={s.held} ghost={ghost} ghostColor={SLOT_COLORS[s.focus % SLOT_COLORS.length]} onKey={(n) => playChord([n], 0.8)} />
    </main>
  );
}
