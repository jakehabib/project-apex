/** The seven-map competitive pool. `playable` maps exist in the engine; the rest are being built. */
export const ACTIVE_POOL = [
  { id: 'harbor', name: 'Harbor', playable: true },
  { id: 'switchyard', name: 'Switchyard', playable: true },
  { id: 'citadel', name: 'Citadel', playable: false },
  { id: 'glassworks', name: 'Glassworks', playable: false },
  { id: 'plateau', name: 'Plateau', playable: false },
  { id: 'underpass', name: 'Underpass', playable: false },
  { id: 'foundry', name: 'Foundry', playable: false },
] as const;

export const POOL_IDS: readonly string[] = ACTIVE_POOL.map((m) => m.id);
