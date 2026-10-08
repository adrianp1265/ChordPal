import { useMemo, useState } from 'react';
import { pct } from './format';
import { chordName, chordPcs, defaultVoicing, sameChord, type Chord } from '../theory/chord';
import type { Key } from '../theory/keys';
import { prettyLabel, toLabel } from '../theory/numerals';
import { voiceNear } from '../theory/voiceLeading';
import { substitutes } from '../engine/subs';
import { playChord, playSequence } from '../audio/piano';
import { useStore } from '../store';
import { MiniKeys } from './MiniKeys';


interface Props {
  chords: Chord[];
  keyNow: Key;
  loop?: boolean;
  title?: string;
  subtitle?: string;
  /** Right-hand badge, e.g. "31% of songs". */
  badge?: string;
  badgeTitle?: string;
  footer?: React.ReactNode;
  startVoicing?: number[];
}

/**
 * One progression: each chord with its number and key picture, Play, Add to
 * loop. Tap a chord to see what else commonly fits in that spot and swap it.
 */
export function ProgressionRow(props: Props) {
  // A new progression (another chord played, another key) starts fresh: no stale swaps.
  const sig = props.chords.map((c) => `${c.root}:${c.type}:${c.bass ?? ''}`).join(',') + `@${props.keyNow.tonic}${props.keyNow.mode}`;
  return <Row key={sig} {...props} />;
}

function Row({ chords: original, keyNow, loop = true, title, subtitle, badge, badgeTitle, footer, startVoicing }: Props) {
  const { tables, settings, captureMany, trail } = useStore();
  const [chords, setChords] = useState(original);
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  const voicings = useMemo(() => {
    const v = [startVoicing?.length ? startVoicing : defaultVoicing(chords[0])];
    for (const c of chords.slice(1)) v.push(voiceNear(v[v.length - 1], chordPcs(c)));
    return v;
  }, [chords, startVoicing]);

  const g = tables[`${settings.genre}-${keyNow.mode}`] ?? null;
  const all = tables[`all-${keyNow.mode}`] ?? null;
  const subs = useMemo(() => {
    if (swapAt === null) return [];
    const n = chords.length;
    const prev = swapAt > 0 ? chords[swapAt - 1] : loop ? chords[n - 1] : null;
    const next = swapAt < n - 1 ? chords[swapAt + 1] : loop ? chords[0] : null;
    return substitutes(prev, chords[swapAt], next, keyNow, g, all);
  }, [swapAt, chords, keyNow, g, all, loop]);

  const changed = chords.some((c, i) => !sameChord(c, original[i]));
  const add = () => {
    const items = chords.map((chord, i) => ({ chord, voicing: voicings[i] }));
    const last = trail[trail.length - 1];
    captureMany(last && sameChord(last.chord, chords[0]) ? items.slice(1) : items);
  };

  return (
    <li className="prog">
      {(title || badge) && (
        <div className="prog-title">
          <span>{title && <b>{title}</b>}{title && subtitle && ' '}{subtitle && <span className="muted">{subtitle}</span>}</span>
          {badge && <span className="prog-p" title={badgeTitle}>{badge}</span>}
        </div>
      )}
      <div className="prog-chords">
        {chords.map((c, j) => (
          <button key={j} className={'prog-chord' + (playing === j ? ' playing' : '') + (swapAt === j ? ' swapping' : '') + (!sameChord(c, original[j]) ? ' swapped' : '')}
            onClick={() => { playChord(voicings[j]); setSwapAt(swapAt === j ? null : j); }} title="Hear it and see what else fits here">
            <span className="pc-name">{chordName(c)}</span>
            <span className="pc-num">{prettyLabel(toLabel(c, keyNow))}</span>
            <MiniKeys notes={voicings[j]} color="var(--accent)" label={false} />
          </button>
        ))}
      </div>
      {swapAt !== null && (
        <div className="swap">
          <span className="muted">Instead of {chordName(chords[swapAt])} here, songs often use:</span>
          <div className="swap-list">
            {subs.length === 0 && <span className="muted">Nothing common. Try another spot.</span>}
            {subs.map((s) => (
              <button key={s.label} onClick={() => { const next = [...chords]; next[swapAt] = s.chord; setChords(next); playChord(voiceNear(voicings[swapAt], chordPcs(s.chord))); }}>
                <b>{chordName(s.chord)}</b> <span className="muted">{prettyLabel(s.label)} · {pct(s.p)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {footer}
      <div className="prog-side">
        <button onClick={() => playSequence(voicings, settings.bpm, (i) => setPlaying(i < 0 ? null : i))}>▶ Play</button>
        <button onClick={add}>Add to loop</button>
        {changed && <button onClick={() => { setChords(original); setSwapAt(null); }}>Reset</button>}
      </div>
    </li>
  );
}
