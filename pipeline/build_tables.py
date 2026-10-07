#!/usr/bin/env python3
"""Build ChordPal's next-chord tables.

Sources (any that are present):
  --chordonomicon PATH  Chordonomicon CSV (huggingface.co/datasets/ailsntua/Chordonomicon)
  --jazz PATH|auto      JazzStandards.json (github.com/mikeoliphant/JazzStandards); auto = download
  --seeds PATH          pipeline/seeds.txt, hand-written starter progressions; used for
                        a genre only when Chordonomicon is not given.

Writes public/data/<genre>-<mode>.json and public/data/index.json.
Chords become numbers in the song's key ("4", "6m", "b7maj7"), using the same 17
types and the same Krumhansl-Kessler key finding as the app (src/theory).
"""
import argparse, ast, csv, json, math, os, re, sys, urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.cache')
URLS = {
    'jazz': 'https://raw.githubusercontent.com/mikeoliphant/JazzStandards/main/JazzStandards.json',
    'mapping': 'https://raw.githubusercontent.com/spyroskantarelis/chordonomicon/main/chords_mapping.csv',
}


def fetch(name):
    """Download a public source file once into pipeline/.cache."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, os.path.basename(URLS[name]))
    if not os.path.exists(path):
        print(f'downloading {URLS[name]}', file=sys.stderr)
        urllib.request.urlretrieve(URLS[name], path)
    return path
GENRES = ['all', 'pop', 'folk', 'jazz', 'house']
MODES = ['major', 'minor']

# id, table code, intervals  (mirror of src/theory/chordTypes.ts)
TYPES = [
    ('maj', '', [0, 4, 7]), ('m', 'm', [0, 3, 7]), ('7', '7', [0, 4, 7, 10]),
    ('maj7', 'maj7', [0, 4, 7, 11]), ('m7', 'm7', [0, 3, 7, 10]), ('sus2', 'sus2', [0, 2, 7]),
    ('sus4', 'sus4', [0, 5, 7]), ('add9', 'add9', [0, 2, 4, 7]), ('6', '6', [0, 4, 7, 9]),
    ('m6', 'm6', [0, 3, 7, 9]), ('9', '9', [0, 2, 4, 7, 10]), ('maj9', 'maj9', [0, 2, 4, 7, 11]),
    ('m9', 'm9', [0, 2, 3, 7, 10]), ('dim', 'dim', [0, 3, 6]), ('dim7', 'dim7', [0, 3, 6, 9]),
    ('m7b5', 'm7b5', [0, 3, 6, 10]), ('aug', 'aug', [0, 4, 8]),
]
CODE = {t: c for t, c, _ in TYPES}
INTERVALS = {t: iv for t, _, iv in TYPES}
DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7']

KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

LETTER = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


# ---------------------------------------------------------------- chord parsing

def nearest_type(iv):
    """Map any interval set (0 = root) onto the nearest of the 17 types."""
    iv = set(i % 12 for i in iv)
    maj3, min3 = 4 in iv, 3 in iv
    p5, b5, s5 = 7 in iv, 6 in iv, 8 in iv
    b7, M7, d7 = 10 in iv, 11 in iv, 9 in iv
    ninth = 2 in iv
    if min3 and not maj3:
        if b5 and not p5:
            if b7: return 'm7b5'
            if d7: return 'dim7'
            return 'dim'
        if b7: return 'm9' if ninth else 'm7'
        if d7 and not M7: return 'm6'
        return 'm'
    if maj3:
        if s5 and not p5 and not b7 and not M7: return 'aug'
        if b7: return '9' if ninth else '7'
        if M7: return 'maj9' if ninth else 'maj7'
        if d7: return '6'
        if ninth: return 'add9'
        return 'maj'
    # no third
    if 5 in iv: return '7' if b7 else 'sus4'
    if ninth: return 'sus2'
    return 'maj'  # power chord / bare root


def parse_root(s):
    m = re.match(r'^([A-G])([#sb]?)', s)
    if not m: return None, s
    pc = LETTER[m.group(1)] + (1 if m.group(2) in ('#', 's') else -1 if m.group(2) == 'b' else 0)
    return pc % 12, s[m.end():]


class Chordonomicon:
    """Symbol -> (root, type) using the dataset's own chords_mapping.csv."""

    def __init__(self, mapping_path):
        self.table = {}
        with open(mapping_path, newline='') as f:
            for row in csv.DictReader(f):
                sym = row['Chords']
                vec = ast.literal_eval(row['Degrees'])
                pcs = {i for i, v in enumerate(vec) if v}
                self.table[sym] = pcs
        self.cache = {}

    def parse(self, sym):
        if sym in self.cache: return self.cache[sym]
        body = sym.split('/')[0]
        pcs = self.table.get(body)
        if pcs is None:
            out = self.parse_text(body)
        else:
            # "Bbmin" has a flat root; "Cb9" is C with a flat 9. Take the root that is in the chord.
            out = None
            for n in (2, 1):
                if n == 2 and not (len(body) >= 2 and body[1] in 'sb#'): continue
                root, _ = parse_root(body[:n])
                if root is not None and root in pcs:
                    out = (root, nearest_type({(p - root) % 12 for p in pcs}))
                    break
        self.cache[sym] = out
        return out

    @staticmethod
    def parse_text(body):
        root, rest = parse_root(body)
        if root is None: return None
        rest = rest.replace('min', 'm')
        return (root, nearest_type(text_intervals(rest)))


def text_intervals(s):
    """Rough interval set from a jazz / chart chord suffix."""
    s = s.strip()
    iv = {0, 4, 7}
    def has(tok):
        return tok in s
    if s.startswith(('maj', '^', 'M')) and not s.startswith('m7'):
        rest = re.sub(r'^(maj|\^|M)', '', s)
        iv = {0, 4, 7, 11} if (rest[:1] in ('7', '9', '1') or rest == '' and s != '') else {0, 4, 7}
        if s in ('maj', 'M'): iv = {0, 4, 7}
        if '9' in rest or '13' in rest: iv |= {2}
        if '#5' in rest or '+' in rest: iv = (iv - {7}) | {8}
        return iv
    if s.startswith(('m', '-')) and not s.startswith('maj'):
        iv = {0, 3, 7}
        s2 = s[1:]
        if s2.startswith('maj') or s2.startswith('^'): return {0, 3, 7, 11}
        if '7b5' in s2: return {0, 3, 6, 10}
        if '6' in s2 and '7' not in s2: iv |= {9}
        if any(t in s2 for t in ('7', '9', '11', '13')): iv |= {10}
        if any(t in s2 for t in ('9', '11', '13')) or '69' in s2: iv |= {2}
        return iv
    if s.startswith(('07', 'o7', 'dim7')): return {0, 3, 6, 9}
    if s.startswith(('0', 'o', 'dim')): return {0, 3, 6}
    if s.startswith(('h', 'ø')): return {0, 3, 6, 10}
    if s.startswith(('+', 'aug')):
        iv = {0, 4, 8}
        if '7' in s or '9' in s: iv |= {10}
        return iv
    if s.startswith('sus') or 'sus' in s:
        iv = {0, 7}
        iv |= {2} if 'sus2' in s else {5}
        if '7' in s or '9' in s or '13' in s: iv |= {10}
        return iv
    if s.startswith('6'):
        iv |= {9}
        if '9' in s: iv |= {2}
        return iv
    if s.startswith('add9') or s.startswith('2'): return iv | {2}
    if s.startswith('5'): return {0, 7}
    if s[:1] in ('7', '9', '1'):
        iv |= {10}
        if s.startswith('9') or s.startswith('13') or s.startswith('11'): iv |= {2}
        if '#5' in s or 'b13' in s and '5' not in s.replace('b13', ''): pass
        if '#5' in s: iv = (iv - {7}) | {8}
        if 'alt' in s: iv = (iv - {7})
        return iv
    if s == '': return iv
    return iv


def parse_jazz(sym):
    sym = re.sub(r'\(.*?\)', '', sym).strip()
    if not sym: return None
    body = sym.split('/')[0]
    root, rest = parse_root(body)
    if root is None: return None
    return (root, nearest_type(text_intervals(rest)))


# ---------------------------------------------------------------- keys

def pearson(a, b):
    n = len(a); ma = sum(a) / n; mb = sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = math.sqrt(sum((x - ma) ** 2 for x in a)); db = math.sqrt(sum((y - mb) ** 2 for y in b))
    return num / (da * db) if da and db else 0.0


def estimate_key(chords):
    w = [0.0] * 12
    for root, t in chords:
        for i in INTERVALS[t]: w[(root + i) % 12] += 1
        w[root] += 1
    best = None
    for tonic in range(12):
        rot = [w[(i + tonic) % 12] for i in range(12)]
        for mode, prof in (('major', KK_MAJOR), ('minor', KK_MINOR)):
            r = pearson(rot, prof)
            if best is None or r > best[0]: best = (r, tonic, mode)
    return best[1], best[2]


def label(chord, tonic):
    root, t = chord
    return DEGREES[(root - tonic) % 12] + CODE[t]


def collapse(seq):
    out = []
    for x in seq:
        if not out or out[-1] != x: out.append(x)
    return out


# ---------------------------------------------------------------- sources

class Counts:
    def __init__(self):
        self.c = {m: defaultdict(Counter) for m in MODES}
        self.songs = 0

    def add_song(self, labels, mode, weight=1.0):
        labels = collapse(labels)
        if len(labels) < 2: return
        self.songs += weight
        c = self.c[mode]
        for i, nxt in enumerate(labels):
            c[''][nxt] += weight
            for n in (1, 2, 3):
                if i - n < 0: break
                c['|'.join(labels[i - n:i])][nxt] += weight

    def merge(self, other, scale=1.0):
        for m in MODES:
            for ctx, cnt in other.c[m].items():
                for k, v in cnt.items(): self.c[m][ctx][k] += v * scale
        self.songs += other.songs


def strip_sections(text):
    return re.sub(r'<[^>]*>', ' ', text).split()


def read_chordonomicon(path, mapping, counts, limit=None):
    import pandas as pd
    cp = Chordonomicon(mapping)
    n = 0
    for chunk in pd.read_csv(path, usecols=['chords', 'main_genre', 'genres'], chunksize=50000):
        chunk = chunk.dropna(subset=['chords'])
        for chords, main, tags in zip(chunk['chords'], chunk['main_genre'], chunk['genres']):
            seq = [cp.parse(s) for s in strip_sections(chords)]
            seq = collapse([c for c in seq if c])
            if len(seq) < 2: continue
            tonic, mode = estimate_key(seq)
            labels = [label(c, tonic) for c in seq]
            tags = str(tags).lower() if isinstance(tags, str) else ''
            main = str(main).lower()
            counts['all'].add_song(labels, mode)
            if main == 'pop': counts['pop'].add_song(labels, mode)
            if main == 'jazz': counts['jazz'].add_song(labels, mode)
            if 'folk' in tags: counts['folk'].add_song(labels, mode)
            if 'house' in tags: counts['house'].add_song(labels, mode)
            n += 1
            if limit and n >= limit: return n
    return n


def read_jazz(path):
    songs = json.load(open(path))
    out = []
    for tune in songs:
        seq = []
        for sec in tune.get('Sections', []):
            main = sec.get('MainSegment', {}).get('Chords', '')
            ends = [e.get('Chords', '') for e in sec.get('Endings', [])] or ['']
            for e in ends:
                for part in (main, e):
                    for sym in re.split(r'[|,]', part):
                        c = parse_jazz(sym)
                        if c: seq.append(c)
        seq = collapse(seq)
        if len(seq) < 2: continue
        k = tune.get('Key')
        if k:
            tonic, _ = parse_root(k)
            mode = 'minor' if k.endswith(('min', '-', 'm')) else 'major'
        else:
            tonic, mode = estimate_key(seq)
        out.append(([label(c, tonic) for c in seq], mode))
    return out


def read_seeds(path):
    """Lines: genre | mode | weight | labels...  (looped, so the last chord leads back to the first)."""
    out = []
    for line in open(path):
        line = line.split('#')[0].strip()
        if not line: continue
        genre, mode, weight, prog = [x.strip() for x in line.split('|')]
        labels = prog.split()
        out.append((genre, mode, float(weight), labels * 4))
    return out


# ---------------------------------------------------------------- output

def build_table(counts, mode, min1=5, min3=20, top=12):
    next_ = {}
    for ctx, cnt in counts.c[mode].items():
        total = sum(cnt.values())
        n = ctx.count('|') + 1 if ctx else 0
        if ctx and total < (min3 if n == 3 else min1): continue
        items = cnt.most_common() if ctx == '' else cnt.most_common(top)
        s = sum(v for _, v in items)
        next_[ctx] = {k: round(v / s, 4) for k, v in items if v / s >= 0.0005}
    return next_


def write(outdir, genre, mode, counts, source, max_bytes=2_000_000):
    min1, min3 = 5, 20
    while True:
        table = {'genre': genre, 'mode': mode, 'songs': round(counts.songs), 'source': source,
                 'next': build_table(counts, mode, min1, min3)}
        text = json.dumps(table, separators=(',', ':'))
        if len(text) <= max_bytes: break
        min1, min3 = min1 * 2, min3 * 2
    with open(os.path.join(outdir, f'{genre}-{mode}.json'), 'w') as f: f.write(text)
    return len(text), len(table['next'])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--chordonomicon')
    ap.add_argument('--mapping', help="Chordonomicon's chords_mapping.csv (downloaded if omitted)")
    ap.add_argument('--jazz', help="JazzStandards.json, or 'auto' to download it")
    ap.add_argument('--seeds', default=os.path.join(HERE, 'seeds.txt'))
    ap.add_argument('--out', default=os.path.join(HERE, '..', 'public', 'data'))
    ap.add_argument('--limit', type=int, help='read only this many Chordonomicon rows (testing)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    counts = {g: Counts() for g in GENRES}
    source = {g: [] for g in GENRES}
    if a.jazz == 'auto': a.jazz = fetch('jazz')
    if a.chordonomicon:
        n = read_chordonomicon(a.chordonomicon, a.mapping or fetch('mapping'), counts, a.limit)
        print(f'chordonomicon: {n} songs', file=sys.stderr)
        for g in GENRES: source[g].append('chordonomicon')
    if a.jazz:
        tunes = read_jazz(a.jazz)
        print(f'jazz standards: {len(tunes)} tunes', file=sys.stderr)
        for labels, mode in tunes:
            counts['jazz'].add_song(labels, mode)
            if a.chordonomicon: counts['all'].add_song(labels, mode)
        source['jazz'].append('jazzstandards')
    if not a.chordonomicon and a.seeds and os.path.exists(a.seeds):
        real = {g: counts[g].songs > 0 for g in GENRES}
        for genre, mode, w, labels in read_seeds(a.seeds):
            if genre in counts and not real[genre]:
                counts[genre].add_song(labels, mode, w)
                if 'starter' not in source[genre]: source[genre].append('starter')
        # All without Chordonomicon: every genre counted equally.
        for g in GENRES[1:]:
            tot = sum(sum(c.values()) for m in MODES for c in [counts[g].c[m]['']])
            if tot: counts['all'].merge(counts[g], 10000 / tot)
            source['all'] += [s for s in source[g] if s not in source['all']]
        counts['all'].songs = sum(counts[g].songs for g in GENRES[1:])

    index = {'genres': {}}
    for g in GENRES:
        for m in MODES:
            size, ctxs = write(a.out, g, m, counts[g], '+'.join(source[g]) or 'none')
            print(f'{g}-{m}: {size/1000:.0f} KB, {ctxs} contexts', file=sys.stderr)
        index['genres'][g] = {'songs': round(counts[g].songs), 'source': '+'.join(source[g]) or 'none'}
    with open(os.path.join(a.out, 'index.json'), 'w') as f: json.dump(index, f, indent=1)


if __name__ == '__main__':
    main()
