import { ArtGallery } from './screens/ArtGallery';
import { WorldHub } from './screens/WorldHub';
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
    </div>
  );
}
