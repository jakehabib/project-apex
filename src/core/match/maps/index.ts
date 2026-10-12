import { HARBOR } from './harbor';
import { SWITCHYARD } from './switchyard';
import type { MapDefinition } from './types';

/** Active-duty map pool. Order is display order. */
export const MAP_POOL: readonly MapDefinition[] = [HARBOR, SWITCHYARD];

export function mapById(id: string): MapDefinition {
  const m = MAP_POOL.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown map ${id}`);
  return m;
}

export { HARBOR, SWITCHYARD };
