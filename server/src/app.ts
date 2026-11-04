import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BatchSchema } from './schema';
import { recordCanary, recordAlertWebhook, register } from './metrics';
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

  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
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

  const CanarySchema = z
    .object({
      ok: z.boolean(),
      missing: z.array(z.enum(['player', 'video', 'adOverlay', 'skipButton', 'adBadge'])).max(5),
      ts: z.number().int().positive(),
    })
    .strict();

  app.post('/canary', async (req, reply) => {
    const parsed = CanarySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid canary' });
    }
    recordCanary(parsed.data.ok);
    return reply.code(202).send({ accepted: true });
  });

  // Bể hứng cảnh báo Webhook từ Grafana
  app.post('/alert-hook', async (req, reply) => {
    const body = req.body as any;
    const status = typeof body?.status === 'string' ? body.status : 'firing';
    recordAlertWebhook(status);
    return reply.code(200).send({ status: 'received' });
  });

  return app;
}