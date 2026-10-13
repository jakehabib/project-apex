import { CareerNew } from './career/CareerNew';
import { CareerSaves } from './career/CareerSaves';
import { CareerShell } from './career/CareerShell';
import { ArtGallery } from './screens/ArtGallery';
import { WorldHub } from './screens/WorldHub';
import { MatchDay } from './screens/MatchDay';
import { SystemsCheck } from './screens/SystemsCheck';
import { TitleScreen } from './screens/TitleScreen';
import { ViewerProof } from './screens/ViewerProof';
import { useNav } from './state/nav';

export function App() {
  const screen = useNav((s) => s.screen);
  return (
    <div key={screen} className="screen-enter" style={{ height: '100%' }}>
      {screen === 'title' && <TitleScreen />}
      {screen === 'viewer' && <ViewerProof />}
      {screen === 'systems' && <SystemsCheck />}
      {screen === 'gallery' && <ArtGallery />}
      {screen === 'world' && <WorldHub />}
      {screen === 'matchday' && <MatchDay />}
      {screen === 'career-new' && <CareerNew />}
      {screen === 'career-saves' && <CareerSaves />}
      {screen === 'career' && <CareerShell />}
    </div>
  );
}
