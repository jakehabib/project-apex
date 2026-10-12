import type { MapDefinition } from '../../core/match/maps/types';

const pts = (poly: readonly { x: number; y: number }[]) => poly.map((p) => `${p.x},${p.y}`).join(' ');

/** Vector line-art of a map, generated from its real geometry. Decorative. */
export function MapLinework({ map, className }: { map: MapDefinition; className?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${map.width} ${map.height}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <filter id="lw-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="14" strokeLinejoin="round" opacity="0.5">
        {map.areas.map((a) => (
          <polygon key={a.id} points={pts(a.polygon)} />
        ))}
      </g>
      <g fill="var(--bg-0)" stroke="none">
        {map.areas.map((a) => (
          <polygon key={a.id} points={pts(a.polygon)} />
        ))}
      </g>
      <g fill="currentColor" opacity="0.18">
        {map.obstacles.map((o) => (
          <polygon key={o.id} points={pts(o.polygon)} />
        ))}
      </g>
      <g filter="url(#lw-glow)">
        {map.edges.map((e) => {
          const a = map.nodes.find((n) => n.id === e.a)!.pos;
          const b = map.nodes.find((n) => n.id === e.b)!.pos;
          return <line key={`${e.a}-${e.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth="2" opacity="0.35" strokeDasharray="6 10" />;
        })}
      </g>
      {(['A', 'B'] as const).map((s) => (
        <text key={s} x={map.sites[s].label.x} y={map.sites[s].label.y + 40} fill="currentColor" opacity="0.5" fontFamily="Barlow Condensed" fontWeight="700" fontSize="120" textAnchor="middle">
          {s}
        </text>
      ))}
    </svg>
  );
}
