import { create } from 'zustand';

export type Screen = 'title' | 'viewer' | 'systems';

interface NavState {
  screen: Screen;
  go: (screen: Screen) => void;
}

export const useNav = create<NavState>((set) => ({
  screen: 'title',
  go: (screen) => set({ screen }),
}));
