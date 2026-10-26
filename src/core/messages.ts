import type { AdPhase } from './types';

export interface TabStatus {
  phase: AdPhase;
  adsDetected: number;
  adSeconds: number;
  updatedAt: number;
  adKind: string | null;
  confidence: number;
  interventionsOk: number;
  interventionsFail: number;
}

export type Msg =
  | { kind: 'STATUS_UPDATE'; status: TabStatus }
  | { kind: 'GET_STATUS'; tabId: number };

export const statusKey = (tabId: number) => `tab:${tabId}`;

export const emptyStatus = (): TabStatus => ({
  phase: 'UNKNOWN',
  adsDetected: 0,
  adSeconds: 0,
  updatedAt: 0,
  adKind: null,
  confidence: 0,
  interventionsOk: 0,
  interventionsFail: 0,
});

export function isMsg(x: unknown): x is Msg {
  if (typeof x !== 'object' || x === null) return false;
  const m = x as { kind?: unknown; tabId?: unknown; status?: unknown };
  if (m.kind === 'GET_STATUS') return typeof m.tabId === 'number';
  if (m.kind === 'STATUS_UPDATE') return typeof m.status === 'object' && m.status !== null;
  return false;
}
