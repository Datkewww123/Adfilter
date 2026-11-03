import type { Pool } from 'pg';

export interface CanaryReport {
  totalEvents: number;
  enforcementSeen: number;
  playbackStuck: number;
  enforcementRate: number;
  alertTriggered: boolean;
}

export async function runCanaryCheck(pool: Pool, windowMinutes = 60): Promise<CanaryReport> {
  const query = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE type = 'ENFORCEMENT_SEEN') AS enforcement,
      COUNT(*) FILTER (WHERE type = 'PLAYBACK_STUCK') AS stuck
    FROM events
    WHERE ts > NOW() - ($1 || ' minutes')::INTERVAL
  `;

  const res = await pool.query(query, [windowMinutes]);
  const row = res.rows[0];

  const totalEvents = parseInt(row?.total || '0', 10);
  const enforcementSeen = parseInt(row?.enforcement || '0', 10);
  const playbackStuck = parseInt(row?.stuck || '0', 10);

  const enforcementRate = totalEvents > 0 ? (enforcementSeen / totalEvents) * 100 : 0;
  const alertTriggered = enforcementRate >= 5.0 && totalEvents >= 20;

  return {
    totalEvents,
    enforcementSeen,
    playbackStuck,
    enforcementRate: Number(enforcementRate.toFixed(2)),
    alertTriggered,
  };
}