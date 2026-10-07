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

They are generated, not committed: `npm run dev` / `npm run build` build them once (downloading
JazzStandards), together with the piano samples and icons. To rebuild with Chordonomicon:

```
CHORDONOMICON=chordonomicon_v2.csv npm run data
```

- **Chordonomicon** ([Hugging Face](https://huggingface.co/datasets/ailsntua/Chordonomicon), CC BY-NC 4.0): download
  `chordonomicon_v2.csv` and pass it in. Chord symbols are mapped by their notes using the dataset's own
  `chords_mapping.csv` (downloaded from its GitHub repo; note that its `dim7` is half-diminished and `dimb7` is diminished).
- **JazzStandards** ([GitHub](https://github.com/mikeoliphant/JazzStandards), no license stated: personal use).
- **Starter lists** (`pipeline/seeds.txt`): hand-written common progressions, used for a genre only when
  Chordonomicon is not given. Until it is, Pop, Folk and House are starter data and the app says so.

## Credits

- Piano: [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC BY 3.0
  (samples via [Tone.js audio](https://github.com/Tonejs/audio)).
- Key profiles: Krumhansl & Kessler (1982).
