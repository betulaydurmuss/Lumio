import { z } from 'zod';

export const dependencyStatusSchema = z.enum(['up', 'down']);

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  checks: z.object({
    database: dependencyStatusSchema,
    redis: dependencyStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
