import { useEffect, useMemo, useState } from 'react';
import { mod12 } from '../theory/pitch';

const BLACK = new Set([1, 3, 6, 8, 10]);
const isBlack = (n: number) => BLACK.has(mod12(n));

interface Props {
  held: number[];
  ghost: number[];
  ghostColor: string;
  onKey?: (n: number) => void;
}

/** 49 keys (C2-C6) on a wide screen, two octaves on a phone, scrolled to where you play. */
export function Keyboard({ held, ghost, ghostColor, onKey }: Props) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 720);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 720);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  const [lo, hi] = useMemo(() => {
    if (!narrow) return [36, 84];
    const notes = [...held, ...ghost];
    if (!notes.length) return [48, 72];
    const mid = (Math.min(...notes) + Math.max(...notes)) / 2;
    let start = Math.round(mid - 12);
    start -= mod12(start); // start on a C
    if (mid - start > 18) start += 12;
    start = Math.max(24, Math.min(84, start));
    return [start, start + 24];
  }, [narrow, held, ghost]);

  const whites: number[] = [];
  for (let n = lo; n <= hi; n++) if (!isBlack(n)) whites.push(n);
  const w = 100 / whites.length;
  const heldSet = new Set(held);
  const ghostSet = new Set(ghost);
  const xOf = (n: number) => whites.indexOf(n) * w;

  return (
    <svg className="keyboard" viewBox="0 0 100 22" preserveAspectRatio="none" role="img" aria-label="Keyboard">
      {whites.map((n) => (
        <rect
          key={n}
          x={xOf(n)}
          y={0}
          width={w}
          height={22}
          className={'kw' + (heldSet.has(n) ? ' held' : '')}
          style={ghostSet.has(n) && !heldSet.has(n) ? { fill: ghostColor, fillOpacity: 0.35, stroke: ghostColor } : undefined}
          onPointerDown={() => onKey?.(n)}
        />
      ))}
      {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
        .filter(isBlack)
        .map((n) => (
          <rect
            key={n}
            x={xOf(n - 1) + w * 0.68}
            y={0}
            width={w * 0.64}
            height={13.5}
            className={'kb' + (heldSet.has(n) ? ' held' : '')}
            style={ghostSet.has(n) && !heldSet.has(n) ? { fill: ghostColor, stroke: ghostColor } : undefined}
            onPointerDown={() => onKey?.(n)}
          />
        ))}
      {whites.filter((n) => mod12(n) === 0).map((n) => (
        <circle key={'c' + n} cx={xOf(n) + w / 2} cy={20} r={0.35} className="kdot" />
      ))}
    </svg>
  );
}
