import { mod12, pcName } from '../theory/pitch';

const BLACK = new Set([1, 3, 6, 8, 10]);

interface Props { notes: number[]; color: string; label?: boolean }

/**
 * A small keyboard picture of exactly which keys to press: two octaves from the
 * C at or below the lowest note (more if the chord is wider), so every picture
 * is drawn at the same scale.
 */
export function MiniKeys({ notes, color, label = true }: Props) {
  if (!notes.length) return null;
  const lo = Math.min(...notes) - mod12(Math.min(...notes));
  let hi = Math.max(...notes) + (11 - mod12(Math.max(...notes)));
  if (hi - lo < 23) hi = lo + 23;
  const whites: number[] = [];
  for (let n = lo; n <= hi; n++) if (!BLACK.has(mod12(n))) whites.push(n);
  const W = 10, H = 34, BW = 6, BH = 21;
  const on = new Set(notes);
  const x = (n: number) => whites.indexOf(n) * W;
  return (
    <svg className="minikeys" viewBox={`0 0 ${whites.length * W} ${H + (label ? 11 : 0)}`} role="img"
      aria-label={`Keys: ${[...on].sort((a, b) => a - b).map(pcName).join(', ')}`}>
      {whites.map((n) => (
        <rect key={n} x={x(n) + 0.25} y={0.25} width={W - 0.5} height={H} rx={1.2}
          className="mk-w" style={on.has(n) ? { fill: color } : undefined} />
      ))}
      {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((n) => BLACK.has(mod12(n))).map((n) => (
        <rect key={n} x={x(n - 1) + W - BW / 2} y={0.25} width={BW} height={BH} rx={0.8}
          className="mk-b" style={on.has(n) ? { fill: color, stroke: '#111' } : undefined} />
      ))}
      {label && [...on].sort((a, b) => a - b).map((n) => {
        const cx = BLACK.has(mod12(n)) ? x(n - 1) + W : x(n) + W / 2;
        return <text key={'l' + n} x={cx} y={H + 10} className="mk-l">{pcName(n)}</text>;
      })}
    </svg>
  );
}
