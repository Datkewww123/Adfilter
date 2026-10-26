import type { ActionRecord } from './actionRecord';
import { median } from './metrics';

const META = new Set(['ENFORCEMENT_SEEN', 'PLAYBACK_STUCK']);

export interface Summary {
  dryRunRecords: number;
  executed: number;
  notExecuted: number;
  verifiedOk: number;
  verifiedFail: number;
  successRate: number | null;
  playbackStuck: number;
  enforcementSeen: number;
  medianVerifyMs: number | null;
  byAction: Record<string, number>;
}

export function summarizeActions(records: ActionRecord[]): Summary {
  const live = records.filter((r) => !r.dryRun && !META.has(r.action));
  const attempts = live.filter((r) => r.ok !== undefined);
  const verifs = live.filter((r) => r.verified !== undefined);
  const verifiedOk = verifs.filter((r) => r.verified === true).length;

  const byAction: Record<string, number> = {};
  for (const r of attempts) {
    byAction[r.action] = (byAction[r.action] ?? 0) + 1;
  }
  const executed = attempts.filter((r) => r.ok === true).length;
  const latencies = verifs.flatMap((r) => (typeof r.latencyMs === 'number' ? [r.latencyMs] : []));

  return {
    dryRunRecords: records.filter((r) => r.dryRun).length,
    executed,
    notExecuted: attempts.length - executed,
    verifiedOk,
    verifiedFail: verifs.length - verifiedOk,
    successRate: verifs.length === 0 ? null : verifiedOk / verifs.length,
    playbackStuck: records.filter((r) => r.action === 'PLAYBACK_STUCK').length,
    enforcementSeen: records.filter((r) => r.action === 'ENFORCEMENT_SEEN').length,
    medianVerifyMs: median(latencies),
    byAction,
  };
}