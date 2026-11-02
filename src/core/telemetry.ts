import { pushRing } from './ring';

export const EVENT_TYPES = [
  'AD_START',
  'AD_END',
  'INTERVENTION',
  'ENFORCEMENT_SEEN',
  'PLAYBACK_STUCK',
  'ERROR',
] as const;

export const AD_KINDS = ['SKIPPABLE', 'NON_SKIPPABLE', 'SEQUENCE', 'UNKNOWN'] as const;
export const STRATEGIES = ['CLICK_SKIP', 'MUTE_SPEEDUP', 'SEEK_TO_END'] as const;

export interface TelemetryEvent {
  type: string;
  adKind?: string;
  strategy?: string;
  ok?: boolean;
  latencyMs?: number;
  durationMs?: number;
  ts: number;
}

export interface Envelope extends TelemetryEvent {
  clientId: string;
  browser: string;
  version: string;
}

export const MAX_QUEUE = 500;
export const BATCH = 200;

function pick<T extends string>(list: readonly T[], v: unknown): T | undefined {
  return list.find((x) => x === v);
}

function int(v: unknown, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
    ? Math.min(Math.round(v), max)
    : undefined;
}

export function sanitizeEvent(e: TelemetryEvent): TelemetryEvent {
  const out: TelemetryEvent = {
    type: pick(EVENT_TYPES, e.type) ?? 'ERROR',
    ts: Math.max(1, Math.round(e.ts)),
  };

  const adKind = pick(AD_KINDS, e.adKind);
  const strategy = pick(STRATEGIES, e.strategy);
  const latencyMs = int(e.latencyMs, 600_000);
  const durationMs = int(e.durationMs, 3_600_000);

  if (adKind) out.adKind = adKind;
  if (strategy) out.strategy = strategy;
  if (typeof e.ok === 'boolean') out.ok = e.ok;
  if (latencyMs !== undefined) out.latencyMs = latencyMs;
  if (durationMs !== undefined) out.durationMs = durationMs;

  return out;
}

export function envelop(
  e: TelemetryEvent,
  meta: { clientId: string; browser: string; version: string },
): Envelope {
  return {
    ...e,
    clientId: meta.clientId,
    browser: meta.browser.slice(0, 32),
    version: meta.version.slice(0, 32),
  };
}

export const enqueue = (queue: readonly Envelope[], e: Envelope): Envelope[] =>
  pushRing(queue, e, MAX_QUEUE);

export function splitBatch(queue: readonly Envelope[]): { batch: Envelope[]; rest: Envelope[] } {
  return { batch: queue.slice(0, BATCH), rest: queue.slice(BATCH) };
}