import { create } from 'zustand';

export type Screen = 'title' | 'viewer' | 'systems' | 'gallery' | 'world' | 'matchday' | 'career-new' | 'career-saves' | 'career';

interface NavState {
  screen: Screen;
  go: (screen: Screen) => void;
}

export const useNav = create<NavState>((set) => ({
  screen: 'title',
  go: (screen) => set({ screen }),
}));
