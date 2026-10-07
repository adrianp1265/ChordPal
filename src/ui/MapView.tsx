import * as d3 from 'd3';
import { useEffect, useRef } from 'react';
import { chordId, chordName, type Chord } from '../theory/chord';
import { prettyLabel, toLabel } from '../theory/numerals';
import type { Key } from '../theory/keys';
import type { Suggestion } from '../engine/score';
import { SLOT_COLORS } from './colors';

interface Props {
  current: Chord | null;
  keyNow: Key | null;
  suggestions: Suggestion[];
  focus: number;
  onFocus(i: number): void;
  onGo(i: number): void;
}

interface Node { id: string; name: string; sub: string; x: number; y: number; r: number; color: string; i: number }

const W = 460, H = 380, CX = W / 2, CY = H / 2;

/**
 * The current chord in the middle, the top suggestions around it. Common moves
 * sit close, adventurous ones farther out; node size is the score.
 */
export function MapView({ current, keyNow, suggestions, focus, onFocus, onGo }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const last = useRef(new Map<string, { x: number; y: number }>());

  useEffect(() => {
    const svg = d3.select(ref.current!);
    const maxScore = Math.max(...suggestions.map((s) => s.score), 1e-9);
    const nodes: Node[] = suggestions.map((s, i) => {
      // spread around the circle, best first at the top, alternating sides
      const slot = i === 0 ? 0 : i % 2 ? Math.ceil(i / 2) : -i / 2;
      const ang = -Math.PI / 2 + slot * ((2 * Math.PI) / Math.max(suggestions.length, 1));
      const dist = 108 + (1 - s.phat) * 58;
      return {
        id: chordId(s.chord), name: chordName(s.chord), sub: prettyLabel(s.label),
        x: CX + Math.cos(ang) * dist * 1.12, y: CY + Math.sin(ang) * dist * 0.9,
        r: 15 + 13 * (s.score / maxScore), color: SLOT_COLORS[i % SLOT_COLORS.length], i,
      };
    });
    const center = current
      ? [{ id: chordId(current), name: chordName(current), sub: keyNow ? prettyLabel(toLabel(current, keyNow)) : '', x: CX, y: CY, r: 34, color: '#222', i: -1 }]
      : [];

    svg.select('g.links').selectAll<SVGLineElement, Node>('line').data(nodes, (d) => d.id)
      .join(
        (enter) => enter.append('line').attr('x1', CX).attr('y1', CY).attr('x2', CX).attr('y2', CY),
        (update) => update,
        (exit) => exit.remove(),
      )
      .attr('stroke', (d) => d.color)
      .attr('stroke-opacity', (d) => (d.i === focus ? 0.8 : 0.25))
      .attr('stroke-width', (d) => (d.i === focus ? 2.5 : 1.5))
      .transition().duration(450).ease(d3.easeCubicOut).attr('x2', (d) => d.x).attr('y2', (d) => d.y);

    const all = [...center, ...nodes];
    const g = svg.select('g.nodes').selectAll<SVGGElement, Node>('g.node').data(all, (d) => d.id)
      .join(
        (enter) => {
          const e = enter.append('g').attr('class', 'node')
            .attr('transform', (d) => {
              const p = last.current.get(d.id) ?? { x: CX, y: CY };
              return `translate(${p.x},${p.y})`;
            })
            .style('opacity', 0);
          e.append('circle');
          e.append('text').attr('class', 'n1');
          e.append('text').attr('class', 'n2');
          return e;
        },
        (update) => update,
        (exit) => exit.transition().duration(450).ease(d3.easeCubicOut).style('opacity', 0).remove(),
      );
    g.classed('center', (d) => d.i < 0).classed('focused', (d) => d.i === focus)
      .on('click', (_, d) => { if (d.i >= 0) onFocus(d.i); })
      .on('dblclick', (_, d) => { if (d.i >= 0) onGo(d.i); });
    g.select('circle').attr('fill', (d) => (d.i < 0 ? '#222' : d.color)).attr('fill-opacity', (d) => (d.i < 0 ? 1 : d.i === focus ? 0.95 : 0.7))
      .transition().duration(450).ease(d3.easeCubicOut).attr('r', (d) => d.r);
    g.select('text.n1').text((d) => d.name).attr('dy', (d) => (d.sub ? -2 : 4)).style('font-size', (d) => `${Math.max(10, Math.min(16, d.r * 0.55))}px`);
    g.select('text.n2').text((d) => d.sub).attr('dy', 12).style('font-size', '9px');
    g.transition().duration(450).ease(d3.easeCubicOut).style('opacity', 1).attr('transform', (d) => `translate(${d.x},${d.y})`);
    last.current = new Map(all.map((d) => [d.id, { x: d.x, y: d.y }]));
  }, [current, keyNow, suggestions, focus, onFocus, onGo]);

  const f = suggestions[focus];
  return (
    <div className="map">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Next-chord map">
        <g className="links" />
        <g className="nodes" />
      </svg>
      {!current && <p className="hint">Play a chord, or pick one from the library.</p>}
      {f && (
        <button className="go" style={{ background: SLOT_COLORS[focus % SLOT_COLORS.length] }} onClick={() => onGo(focus)}>
          Go to {chordName(f.chord)}
        </button>
      )}
    </div>
  );
}
