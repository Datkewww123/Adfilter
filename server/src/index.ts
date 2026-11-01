import { Pool } from 'pg';
import { buildApp } from './app';
import { PostgresStore } from './store';

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL environment variable. See .env.example.');
  process.exit(1);
}

const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30000 });
const store = new PostgresStore(pool);
const app = buildApp(store);

async function start() {
  try {
    await app.listen({ port, host });
    console.log(`🚀 AdFilter Telemetry Server đang chạy tại http://${host}:${port}`);
  } catch (err) {
    console.error('Lỗi khởi động máy chủ:', err);
    process.exit(1);
  }
}

const stop = async (): Promise<void> => {
  await app.close();
  await pool.end();
  process.exit(0);
};

process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());

void start();