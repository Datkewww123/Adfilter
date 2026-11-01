import { z } from 'zod';

export const EventSchema = z
  .object({
    clientId: z.string().uuid(),
    browser: z.string().max(32),
    version: z.string().max(32),
    type: z.enum([
      'AD_START',
      'AD_END',
      'INTERVENTION',
      'ENFORCEMENT_SEEN',
      'PLAYBACK_STUCK',
      'ERROR',
    ]),
    adKind: z.enum(['SKIPPABLE', 'NON_SKIPPABLE', 'SEQUENCE', 'UNKNOWN']).optional(),
    strategy: z.enum(['CLICK_SKIP', 'MUTE_SPEEDUP', 'SEEK_TO_END']).optional(),
    ok: z.boolean().optional(),
    latencyMs: z.number().int().min(0).max(600_000).optional(),
    durationMs: z.number().int().min(0).max(3_600_000).optional(),
    ts: z.number().int().positive(),
  })
  .strict();

export const BatchSchema = z.array(EventSchema).max(200);

export type EventInput = z.infer<typeof EventSchema>;