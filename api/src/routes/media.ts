import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { HttpError } from '../middleware/errors.js';
import type { Services } from '../services.js';

/** Parses a single `bytes=start-end` range. Multi-range requests are served whole. */
function parseRange(header: string | undefined, size: number) {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, from, to] = match;
  if (!from && !to) return null;
  let start: number;
  let end: number;
  if (!from) {
    // "bytes=-500": the last 500 bytes.
    start = Math.max(0, size - Number(to));
    end = size - 1;
  } else {
    start = Number(from);
    end = to ? Math.min(Number(to), size - 1) : size - 1;
  }
  if (start > end || start >= size) return 'unsatisfiable' as const;
  return { start, end };
}

/** Streams lesson media behind a signed, expiring link. Seeking uses HTTP range requests. */
export function mediaRouter(services: Services): Router {
  const router = Router();

  router.get('/:token', async (req, res) => {
    const result = services.media.signer.verify(req.params.token);
    if ('error' in result) {
      throw result.error === 'expired'
        ? new HttpError(410, 'link_expired', 'This media link has expired')
        : new HttpError(403, 'invalid_link', 'This media link is not valid');
    }

    const object = await services.media.store.head(result.key);
    if (!object) throw new HttpError(404, 'not_found', 'Media not found');

    // Overrides the API-wide no-store: the link itself expires, so a private cache is fine.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', object.contentType);
    res.setHeader('Content-Disposition', 'inline');

    const range = parseRange(req.get('range'), object.size);
    if (range === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${object.size}`);
      res.status(416).end();
      return;
    }
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${object.size}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      await pipeline(services.media.store.read(result.key, range), res);
      return;
    }
    res.setHeader('Content-Length', String(object.size));
    await pipeline(services.media.store.read(result.key), res);
  });

  return router;
}
