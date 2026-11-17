import { pino, type DestinationStream } from 'pino';

/**
 * Some URLs are credentials: a signed media link is a bearer token, and a
 * certificate's `k` code unlocks the holder's name and document. Logs keep the
 * route and drop those parts, so log access never becomes data access.
 */
export function redactUrl(url: string): string {
  const [path = '', query] = url.split('?', 2);
  const safePath = path.replace(/^(\/api\/media\/)[^/]+/, '$1[redacted]');
  if (!query) return safePath;
  const safeQuery = query
    .split('&')
    .map((pair) => (/^(k|token)=/.test(pair) ? `${pair.split('=')[0]}=[redacted]` : pair))
    .join('&');
  return `${safePath}?${safeQuery}`;
}

export function createLogger(level: string, destination?: DestinationStream) {
  const options = {
    level,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      censor: '[redacted]',
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = ReturnType<typeof createLogger>;
