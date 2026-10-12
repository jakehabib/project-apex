import { useState } from 'react';
import { ART_COACHES, ART_PLAYERS, ART_TEAMS, MAP_ART_SPECS, crestUrl, mapKeyArtUrl, portraitUrl, teamById } from '../art/generated';
import { PlayerPortrait } from '../components/PlayerPortrait';
import { useNav } from '../state/nav';
import './gallery.css';

function Crest({ teamId, size }: { teamId: string; size: number }) {
  const url = crestUrl(teamId);
  const team = teamById(teamId);
  return url ? (
    <img className="gal-crest" src={url} width={size} height={size} alt={`${team?.name ?? teamId} crest`} draggable={false} />
  ) : (
    <div className="gal-crest gal-crest-empty display" style={{ width: size, height: size }}>
      {team?.tag}
    </div>
  );
}

function TransferPreview() {
  const [playerId, setPlayerId] = useState(ART_PLAYERS[0]!.id);
  const player = ART_PLAYERS.find((p) => p.id === playerId)!;
  const [teamId, setTeamId] = useState(player.team);
  const team = teamById(teamId)!;
  return (
    <section className="gal-transfer" data-testid="transfer-preview">
      <div className="gal-transfer-photo">
        <PlayerPortrait personId={player.id} teamId={teamId} name={player.name} size={768} />
      </div>
      <div className="gal-transfer-side">
        <div className="eyebrow">Transfer preview</div>
        <div className="gal-transfer-nick display">{player.nickname}</div>
        <div className="gal-name">{player.name}</div>
        <div className="gal-meta mono">
          {player.nationality} · {player.age} · {player.role}
        </div>
        <label className="gal-field">
          <span>Player</span>
          <select
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              setTeamId(ART_PLAYERS.find((p) => p.id === e.target.value)!.team);
            }}
          >
            {ART_PLAYERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nickname} ({p.name})
              </option>
            ))}
          </select>
        </label>
        <div className="gal-field">
          <span>Wearing</span>
          <div className="gal-team-pick">
            {ART_TEAMS.map((t) => (
              <button key={t.id} className={`gal-team-btn ${t.id === teamId ? 'is-on' : ''}`} onClick={() => setTeamId(t.id)} title={t.name} data-testid={`wear-${t.id}`}>
                <Crest teamId={t.id} size={40} />
              </button>
            ))}
          </div>
        </div>
        <p className="gal-note">
          Kits are painted on in game, so a transfer to {team.name} needs no new artwork.
        </p>
      </div>
    </section>
  );
}

export function ArtGallery() {
  const go = useNav((s) => s.go);
  const people = [...ART_PLAYERS, ...ART_COACHES];
  const made = people.filter((p) => portraitUrl(p.id)).length;
  return (
    <main className="gal" data-testid="art-gallery">
      <header className="gal-head">
        <button className="btn btn-ghost" onClick={() => go('title')}>
          ← Back
        </button>
        <div>
          <div className="eyebrow">Generated art</div>
          <h1 className="gal-title display">Art Gallery</h1>
        </div>
        <div className="gal-count mono">
          {made} / {people.length} portraits · {ART_TEAMS.filter((t) => crestUrl(t.id)).length} / {ART_TEAMS.length} crests
        </div>
      </header>

      <TransferPreview />

      {ART_TEAMS.map((t) => {
        const roster = ART_PLAYERS.filter((p) => p.team === t.id);
        const coach = ART_COACHES.find((c) => c.team === t.id);
        return (
          <section className="gal-team" key={t.id} data-testid={`team-${t.id}`} style={{ ['--team' as string]: t.kit.base, ['--team2' as string]: t.kit.secondary }}>
            <header className="gal-team-head">
              <Crest teamId={t.id} size={72} />
              <div>
                <h2 className="gal-team-name display">{t.name}</h2>
                <div className="gal-meta mono">
                  {t.tag} · {t.region}
                </div>
              </div>
              <div className="gal-kit" aria-label="Kit colours">
                {[t.kit.base, t.kit.secondary, t.kit.trim].map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </div>
            </header>
            <div className="gal-grid">
              {[...roster, ...(coach ? [coach] : [])].map((p) => (
                <figure className="gal-card" key={p.id} data-testid={`portrait-${p.id}`} data-generated={portraitUrl(p.id) ? 'yes' : 'no'}>
                  <div className="gal-photo">
                    <PlayerPortrait personId={p.id} teamId={t.id} name={p.name} size={384} />
                  </div>
                  <figcaption>
                    <div className="gal-nick display">{p.nickname ?? 'Coach'}</div>
                    <div className="gal-name">{p.name}</div>
                    <div className="gal-meta mono">{p.role ?? 'Head coach'}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}

      <h2 className="gal-section display">Map key art</h2>
      <div className="gal-maps">
        {MAP_ART_SPECS.map((m) => {
          const url = mapKeyArtUrl(m.id);
          return (
            <figure className="gal-map" key={m.id} data-testid={`mapart-${m.id}`} data-generated={url ? 'yes' : 'no'}>
              {url ? <img src={url} alt={`${m.name} key art`} draggable={false} /> : <div className="gal-map-empty">Not generated yet</div>}
              <figcaption className="display">{m.name}</figcaption>
            </figure>
          );
        })}
      </div>
    </main>
  );
}
