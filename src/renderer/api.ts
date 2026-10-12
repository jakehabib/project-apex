import type { ApexApi } from '../shared/ipc';

declare global {
  interface Window {
    apex?: ApexApi;
  }
}

/** The privileged API exists only inside the desktop shell. */
export function getApi(): ApexApi | null {
  return window.apex ?? null;
}
