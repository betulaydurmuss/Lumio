import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Resource not found' } });
};

/**
 * Turns thrown errors into a stable JSON shape. Internal details never reach
 * the client; they go to the log with the request id.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // Body parser failures are the client's: malformed or oversized JSON.
  const type = (err as { type?: unknown }).type;
  if (type === 'entity.parse.failed') {
    res
      .status(400)
      .json({ error: { code: 'invalid_json', message: 'The body is not valid JSON' } });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'too_large', message: 'The body is too large' } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'invalid_input', message: 'Invalid input', issues: err.issues },
    });
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
};
