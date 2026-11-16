import { Router } from 'express';
import type { HealthResponse } from '@lumio/shared';

export interface HealthChecks {
  database: () => Promise<boolean>;
  redis: () => Promise<boolean>;
}

async function probe(check: () => Promise<boolean>): Promise<'up' | 'down'> {
  try {
    return (await check()) ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

export function healthRouter(checks: HealthChecks, version: string): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const [database, redis] = await Promise.all([probe(checks.database), probe(checks.redis)]);
    const body: HealthResponse = {
      status: database === 'up' && redis === 'up' ? 'ok' : 'degraded',
      version,
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
    };
    res.status(body.status === 'ok' ? 200 : 503).json(body);
  });

  return router;
}
