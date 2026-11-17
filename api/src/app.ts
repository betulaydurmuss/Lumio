import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import { redactUrl, type Logger } from './logger.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { authRouter, type AuthRouterOptions } from './routes/auth.js';
import { healthRouter, type HealthChecks } from './routes/health.js';
import { catalogRouter, learningRouter } from './routes/catalog.js';
import { certificatesRouter, myCertificatesRouter } from './routes/certificates.js';
import { learnRouter } from './routes/learn.js';
import { mediaRouter } from './routes/media.js';
import { orgRouter } from './routes/org.js';
import { platformRouter } from './routes/platform.js';
import type { Services } from './services.js';

export interface AppDeps {
  logger: Logger;
  cookieSecret: string;
  checks: HealthChecks;
  version: string;
  services: Services;
  auth?: AuthRouterOptions;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      // Only what an operator needs; query and params are left out because they can
      // carry tokens, and the URL itself goes through redactUrl.
      serializers: {
        req: (req: { id: unknown; method: string; url: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          url: redactUrl(req.url),
          remoteAddress: req.remoteAddress,
        }),
      },
    }),
  );

  // The API only ever returns JSON, so the strictest policy fits.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(
    cors({
      origin: deps.services.webOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser(deps.cookieSecret));

  // Nothing is cached: responses are per-user, and many carry personal data.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', healthRouter(deps.checks, deps.version));
  app.use('/api', csrfProtection);
  app.use('/api/auth', authRouter(deps.services, deps.auth));
  app.use('/api/org', orgRouter(deps.services));
  app.use('/api/platform', platformRouter(deps.services));
  app.use('/api/catalog', catalogRouter(deps.services));
  app.use('/api/me', learningRouter(deps.services));
  app.use('/api/learn', learnRouter(deps.services));
  app.use('/api/media', mediaRouter(deps.services));
  app.use('/api/certificates', certificatesRouter(deps.services));
  app.use('/api/me', myCertificatesRouter(deps.services));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
