/** Save data schemas shared by the main process (validation) and renderer (types). Node-free. */
import { z } from 'zod';

export const LedgerEntrySchema = z.object({
  id: z.string().min(1).max(64),
  seq: z.number().int().nonnegative(),
  clubId: z.string().min(1).max(64),
  amount: z.number().int(),
  category: z.string().min(1).max(32),
  memo: z.string().max(200),
  gameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceEvent: z.string().min(1).max(64),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const SaveSnapshotSchema = z.object({
  name: z.string().min(1).max(64),
  worldSeed: z.string().min(1).max(128),
  simulationVersion: z.string().min(1).max(64),
  world: z.record(z.string(), z.unknown()),
  ledger: z.array(LedgerEntrySchema),
});
export type SaveSnapshot = z.infer<typeof SaveSnapshotSchema>;

export interface SaveSummary {
  readonly slot: string;
  readonly name: string;
  readonly worldSeed: string;
  readonly simulationVersion: string;
  readonly schemaVersion: number;
  readonly updatedAt: string;
  readonly sizeBytes: number;
}

