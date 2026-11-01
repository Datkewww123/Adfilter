import type { Pool } from 'pg';
import type { EventInput } from './schema';

export interface Store {
  insertEvents(events: EventInput[]): Promise<number>;
  ping(): Promise<boolean>;
}

export class PostgresStore implements Store {
  constructor(private pool: Pool) {}

  async ping(): Promise<boolean> {
    try {
      const res = await this.pool.query('SELECT 1 as ok');
      return res.rows[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  async insertEvents(events: EventInput[]): Promise<number> {
    if (events.length === 0) return 0;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query = `
        INSERT INTO events (
          client_id, browser, version, type, ad_kind,
          strategy, ok, latency_ms, duration_ms, ts
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;
      for (const e of events) {
        await client.query(query, [
          e.clientId,
          e.browser,
          e.version,
          e.type,
          e.adKind ?? null,
          e.strategy ?? null,
          e.ok ?? null,
          e.latencyMs ?? null,
          e.durationMs ?? null,
          new Date(e.ts),
        ]);
      }
      await client.query('COMMIT');
      return events.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}