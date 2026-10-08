# ChordPal

Names the chord you play on a MIDI keyboard and suggests what can come next, by genre and mood.
Built from the [v1 spec](https://claude.ai/artifact/9yzsHKfgRpi2n8r71r2c97).

Runs in Chrome or Edge (Windows, Android). No server: React + TypeScript on Vite, deployed as static files.

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (naming, keys, voice leading, suggestions, MIDI timing)
npm run build      # dist/, installable and offline (service worker)
node tests/browser/check.mjs http://localhost:4173/   # browser checks with a fake MIDI keyboard (after `npx vite preview`)
```

## Using it

Play a chord (or tap one in the map, cards or library): ChordPal names it and suggests what comes next.
Nothing goes into your loop until you press **Capture** (or Space). **Go** on a card moves there without
saving; **Add to loop** adds a whole progression. Tap any chord in a progression (or in your loop) to see what
else commonly fits there and swap it.

- **Progressions**: the famous progressions your chord can start (your chord's number decides the key), then
  the 3- and 4-chord runs real songs play most often from it, counted per song.
- **Standards**: 12 named progressions (pop loop, 50s, I–IV–V, 12-bar blues, ii–V–I, Andalusian...) in any key,
  ranked by how many songs contain them, with example songs (hand-written in `src/engine/standards.json`).

## How it works

| Step | Code |
| --- | --- |
| MIDI in, held notes, sustain, 80 ms settle, replug | `src/midi/input.ts` |
| Name the chord (17 types, slash chords, power chords, intervals) | `src/theory/naming.ts` |
| Find the key (Krumhansl-Kessler over the last 8 chords, 2-chord hold) | `src/theory/keys.ts` |
| Chords as numbers in the key ("4", "6m", "b7maj7") | `src/theory/numerals.ts` |
| Fewest semitones moved, ghost-key voicing | `src/theory/voiceLeading.ts` |
| P blended over 3/2/1-chord context, mood, Adventure dial, top 8 | `src/engine/` |

`score(x) = M(x) * ((1 - a) * Phat(x) + a * S(x) * (1 - Phat(x)))`

## Data

`public/data/<genre>-<mode>.json` are built by `pipeline/build_tables.py`:

The committed tables are built from Chordonomicon (679,577 songs) plus JazzStandards. Without them,
`npm run dev` / `npm run build` build starter tables (JazzStandards + the starter lists). To rebuild:

```
CHORDONOMICON=chordonomicon_v2.csv npm run data
```

- **Chordonomicon** ([Hugging Face](https://huggingface.co/datasets/ailsntua/Chordonomicon), CC BY-NC 4.0): download
  `chordonomicon_v2.csv` and pass it in. Chord symbols are mapped by their notes using the dataset's own
  `chords_mapping.csv` (downloaded from its GitHub repo; note that its `dim7` is half-diminished and `dimb7` is diminished).
- **JazzStandards** ([GitHub](https://github.com/mikeoliphant/JazzStandards), no license stated: personal use).
- **Starter lists** (`pipeline/seeds.txt`): hand-written common progressions, used for a genre only when
  Chordonomicon is not given (the app then labels the genre "starter data").

Songs per genre in the committed tables: All 680,959 · Pop 85,164 · Folk 44,816 · Jazz 8,376 · House 2,265
(thin, so the app blends it with All). Pop check: after 1, the 5 follows 33% of the time (Hooktheory: 31%).

## Credits

- Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0
  (samples via [Tone.js audio](https://github.com/Tonejs/audio)).
- Key profiles: Krumhansl & Kessler (1982).
