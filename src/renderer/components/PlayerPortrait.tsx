import { useEffect, useState } from 'react';
import { crestUrl, portraitUrl, teamById } from '../art/generated';
import { composeKitPortrait } from '../art/jersey';

/** A person's portrait wearing `teamId`'s kit (composited in game, so transfers need no new art). */
export function PlayerPortrait({ personId, teamId, name, size = 512, className }: { personId: string; teamId: string; name: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const base = portraitUrl(personId);
  const team = teamById(teamId);
  useEffect(() => {
    let live = true;
    setSrc(null);
    if (base && team) void composeKitPortrait(base, team.kit, crestUrl(team.id), { size }).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [base, team, size]);
  if (!base) {
    const letters = name.split(' ').map((w) => w[0]).join('').slice(0, 2);
    return <div className={`portrait-placeholder display ${className ?? ''}`}>{letters}</div>;
  }
  return src ? <img className={className} src={src} alt={`${name} portrait`} draggable={false} data-portrait-ready="yes" /> : <div className={`portrait-loading ${className ?? ''}`} />;
}
