import { MAP_ART_SPECS, PORTRAIT_SPECS, mapKeyArtUrl, portraitUrl } from '../art/generated';
import { useNav } from '../state/nav';
import './gallery.css';

function Initials({ name }: { name: string }) {
  const letters = name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  return <div className="gal-placeholder display">{letters}</div>;
}

export function ArtGallery() {
  const go = useNav((s) => s.go);
  const made = PORTRAIT_SPECS.filter((p) => portraitUrl(p.id)).length + MAP_ART_SPECS.filter((m) => mapKeyArtUrl(m.id)).length;
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
          {made} / {PORTRAIT_SPECS.length + MAP_ART_SPECS.length} generated
        </div>
      </header>

      <h2 className="gal-section display">Player portraits</h2>
      <div className="gal-grid">
        {PORTRAIT_SPECS.map((p) => {
          const url = portraitUrl(p.id);
          return (
            <figure className="gal-card" key={p.id} data-testid={`portrait-${p.id}`} data-generated={url ? 'yes' : 'no'}>
              <div className="gal-photo">{url ? <img src={url} alt={`${p.name} portrait`} draggable={false} /> : <Initials name={p.name} />}</div>
              <figcaption>
                <div className="gal-nick display">{p.nickname}</div>
                <div className="gal-name">{p.name}</div>
                <div className="gal-meta mono">
                  {p.team} · {p.role}
                </div>
                {!url && <div className="gal-missing">Not generated yet</div>}
              </figcaption>
            </figure>
          );
        })}
      </div>

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
