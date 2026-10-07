import * as Tone from 'tone';

// Salamander Grand Piano by Alexander Holm, CC BY 3.0 (samples in public/samples/salamander).
const urls: Record<string, string> = { A0: 'A0.mp3', C8: 'C8.mp3' };
for (let o = 1; o <= 7; o++) for (const [n, f] of [['C', 'C'], ['D#', 'Ds'], ['F#', 'Fs'], ['A', 'A']]) urls[`${n}${o}`] = `${f}${o}.mp3`;

let sampler: Tone.Sampler | null = null;
let ready: Promise<void> | null = null;

/** Call from a user gesture: unlocks audio and loads the piano. */
export function startAudio(): Promise<void> {
  if (!ready) {
    ready = Tone.start().then(
      () =>
        new Promise<void>((resolve) => {
          sampler = new Tone.Sampler({
            urls,
            baseUrl: `${import.meta.env.BASE_URL}samples/salamander/`,
            release: 1.2,
            onload: () => resolve(),
            onerror: () => resolve(),
          }).toDestination();
          sampler.volume.value = -6;
        }),
    );
  }
  return ready;
}

const freq = (midi: number) => Tone.Frequency(midi, 'midi').toNote();

export function playChord(notes: number[], seconds = 1.4, when?: number) {
  if (!sampler?.loaded || notes.length === 0) return;
  const t = when ?? Tone.now();
  notes.forEach((n, i) => sampler!.triggerAttackRelease(freq(n), seconds, t + i * 0.012, 0.7));
}

export function noteOn(n: number, velocity = 100) {
  if (sampler?.loaded) sampler.triggerAttack(freq(n), undefined, velocity / 127);
}

export function noteOff(n: number) {
  if (sampler?.loaded) sampler.triggerRelease(freq(n));
}

let loopId: number | null = null;

/** Loop chords at a tempo, one chord per bar of 4 beats. `onStep` gets the index playing. */
export function playLoop(chords: number[][], bpm: number, onStep: (i: number) => void) {
  stopLoop();
  if (!chords.length) return;
  const bar = (60 / bpm) * 4;
  const transport = Tone.getTransport();
  transport.bpm.value = bpm;
  let i = 0;
  loopId = transport.scheduleRepeat((time) => {
    const idx = i % chords.length;
    playChord(chords[idx], bar * 0.95, time);
    Tone.getDraw().schedule(() => onStep(idx), time);
    i++;
  }, bar, 0);
  transport.start();
}

export function stopLoop() {
  const transport = Tone.getTransport();
  if (loopId !== null) transport.clear(loopId);
  loopId = null;
  transport.stop();
  transport.position = 0;
}
