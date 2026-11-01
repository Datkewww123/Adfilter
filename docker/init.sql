CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  client_id UUID NOT NULL,
  browser VARCHAR(32) NOT NULL,
  version VARCHAR(32) NOT NULL,
  type VARCHAR(32) NOT NULL,
  ad_kind VARCHAR(32),
  strategy VARCHAR(32),
  ok BOOLEAN,
  latency_ms INT,
  duration_ms INT,
  ts TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events (type, ts);
CREATE INDEX IF NOT EXISTS idx_events_client_id ON events (client_id);