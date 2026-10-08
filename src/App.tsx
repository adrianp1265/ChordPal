import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { MidiInput } from './midi/input';
import { noteOff, noteOn, playChord, startAudio } from './audio/piano';
import { chordName, chordPcs, defaultVoicing, type Chord } from './theory/chord';
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
import { Standards } from './ui/Standards';
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
  const [view, setView] = useState<'map' | 'library' | 'progressions' | 'standards'>('map');
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const addedTimer = useRef(0);
  const capture = useCallback(() => {
    if (!useStore.getState().current) return;
    useStore.getState().capture();
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(false), 1200);
  }, []);

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
      if (e.key === ' ' || e.key === 'c') { e.preventDefault(); capture(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [focus, go, capture]);

  if (!s.started) {
    return (
      <main className="start">
        <h1>ChordPal</h1>
        <p>Play a chord. See what comes next.</p>
        <button className="big" onClick={start} disabled={loading}>{loading ? 'Loading piano…' : 'Tap to start'}</button>
      </main>
    );
  }

  const focused = s.suggestions[s.focus];
  const ghost = focused?.voicing ?? [];
  const ghostColor = SLOT_COLORS[s.focus % SLOT_COLORS.length];
  const showName = s.held.length ? s.detected.name : s.current ? s.detected.name : '';
  const tabs = [['map', 'Map'], ['progressions', 'Progressions'], ['standards', 'Standards'], ['library', 'All chords']] as const;

  return (
    <main className="app">
      <header>
        <h1>ChordPal</h1>
        <button className="settings-toggle" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(!settingsOpen)}>
          Settings {settingsOpen ? '▴' : '▾'}
        </button>
        <Controls open={settingsOpen} onSelectMidi={selectMidi} />
      </header>

      <section className="now">
        <div className={'now-name' + (showName ? '' : ' empty')} aria-live="polite">{showName || 'Play a chord'}</div>
        <div className="now-meta">
          {s.key && <span title="The key your playing is in">{keyName(s.key)}{s.settings.keyLock ? ' (locked)' : ''}</span>}
          {s.current && s.key && (
            <span className="num" title={`Its number in ${keyName(s.key)}. 1 is the home chord.`}>{prettyLabel(toLabel(s.current, s.key))}</span>
          )}
          {s.midi.supported && !s.midi.connected && <span className="warn">No MIDI keyboard connected</span>}
        </div>
        <button className={'capture' + (added ? ' added' : '')} onClick={capture} disabled={!s.current} title="Add this chord to your loop (Space)">
          {added ? '✓ Added to loop' : `● Capture${s.current ? ` ${chordName(s.current)}` : ''}`}
        </button>
      </section>

      <section className="middle">
        <div className="pane">
          <div className="tabs" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}>{label}</button>
            ))}
          </div>
          <div className="pane-body">
            {view === 'map' && <MapView current={s.current} keyNow={s.key} suggestions={s.suggestions} focus={s.focus} onFocus={focus} onGo={go} />}
            {view === 'progressions' && <Progressions />}
            {view === 'standards' && <Standards />}
            {view === 'library' && <Library keyNow={s.key} current={s.current} onPick={pick} />}
          </div>
        </div>
        <aside className="next">
          <div className="next-head">
            <b>What could come next</b>
            <span className="muted">Tap to hear it. <b>Go</b> moves there. The bar shows how often songs make that move.</span>
          </div>
          {s.suggestions.length ? (
            <Cards suggestions={s.suggestions} focus={s.focus} onFocus={focus} onUse={go} />
          ) : (
            <p className="hint next-empty">Play a chord and ideas for the next one show up here.</p>
          )}
        </aside>
      </section>

      <Trail />
      <div className="kb-wrap">
        {focused && <span className="kb-cap" style={{ color: ghostColor }}>Shaded keys: {chordName(focused.chord)}</span>}
        <Keyboard held={s.held} ghost={ghost} ghostColor={ghostColor} onKey={(n) => playChord([n], 0.8)} />
      </div>
    </main>
  );
}
