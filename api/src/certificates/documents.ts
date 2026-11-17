/**
 * Drawn certificates, kept in memory. Drawing one at print size takes the CPU
 * for a noticeable moment, and the links that ask for it are public, so the
 * same document is drawn once and then served from here. At most a couple are
 * drawn at a time; the rest wait their turn rather than pile up.
 */
export class DocumentCache {
  private readonly entries = new Map<string, Promise<Buffer>>();
  private readonly sizes = new Map<string, number>();
  private bytes = 0;
  private running = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(
    private readonly maxBytes = 64 * 1024 * 1024,
    private readonly maxRunning = 2,
  ) {}

  /** The document under `key`, drawn with `draw` only when it is not already here. */
  get(key: string, draw: () => Promise<Buffer>): Promise<Buffer> {
    const known = this.entries.get(key);
    if (known) {
      // Most recently used last, so the oldest is the first to go.
      this.entries.delete(key);
      this.entries.set(key, known);
      return known;
    }
    const pending = this.limited(draw).then((bytes) => {
      this.sizes.set(key, bytes.length);
      this.bytes += bytes.length;
      this.evict();
      return bytes;
    });
    // A failed drawing is not remembered, so the next request tries again.
    pending.catch(() => this.entries.delete(key));
    this.entries.set(key, pending);
    return pending;
  }

  private evict() {
    for (const key of this.entries.keys()) {
      if (this.bytes <= this.maxBytes) break;
      const size = this.sizes.get(key);
      if (size === undefined) continue; // still being drawn
      this.entries.delete(key);
      this.sizes.delete(key);
      this.bytes -= size;
    }
  }

  private async limited(draw: () => Promise<Buffer>): Promise<Buffer> {
    if (this.running >= this.maxRunning) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.running += 1;
    try {
      return await draw();
    } finally {
      this.running -= 1;
      this.waiting.shift()?.();
    }
  }
}
