import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { BatchSchema } from './schema';
import type { Store } from './store';

export function buildApp(store: Store): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler<FastifyError>((error, _req, reply) => {
    if (error.validation) {
      return reply.status(400).send({ error: 'bad request', message: error.message });
    }
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    return reply.status(statusCode >= 500 ? 503 : statusCode).send({ error: 'service unavailable' });
  });

  app.get('/health', async (_req, reply) => {
    const ok = await store.ping();
    return ok ? { status: 'healthy' } : reply.status(503).send({ status: 'unhealthy' });
  });

  app.post('/events', async (req, reply) => {
    const parsed = BatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'bad request', details: parsed.error.issues });
    }

    try {
      const inserted = await store.insertEvents(parsed.data);
      return reply.status(202).send({ accepted: inserted });
    } catch {
      return reply.status(503).send({ error: 'service unavailable' });
    }
  });

  return app;
}