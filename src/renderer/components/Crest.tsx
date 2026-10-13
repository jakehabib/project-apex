import { crestUrl } from '../art/generated';

/** Club crest: generated art when the club has it, else a monogram badge in a stable colour. */
export function Crest({ id, tag, size = 40, className = '' }: { id: string; tag: string; size?: number; className?: string }) {
  const url = crestUrl(id);
  if (url) return <img className={`crest ${className}`} src={url} width={size} height={size} alt="" draggable={false} />;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={`crest crest-mono ${className}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32), background: `linear-gradient(145deg, hsl(${h} 42% 34%), hsl(${(h + 40) % 360} 38% 18%))` }}>
      {tag.slice(0, 4)}
    </span>
  );
}
