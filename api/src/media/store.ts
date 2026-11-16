import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';

export interface MediaObject {
  size: number;
  contentType: string;
}

/**
 * Where lesson media lives. The local implementation reads from a directory;
 * an S3-compatible one can replace it without the routes noticing.
 */
export interface MediaStore {
  head(key: string): Promise<MediaObject | null>;
  read(key: string, range?: { start: number; end: number }): Readable;
}

const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8',
};

/** Keys are plain relative paths such as `demo/lesson.mp4`: no dots, no absolute paths. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(mp4|vtt)$/;

export function isValidMediaKey(key: string): boolean {
  return KEY_PATTERN.test(key) && !key.includes('..');
}

export class LocalMediaStore implements MediaStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string | null {
    if (!isValidMediaKey(key)) return null;
    const full = path.resolve(this.root, key);
    // Belt and braces: the resolved path must stay inside the media directory.
    return full.startsWith(this.root + path.sep) ? full : null;
  }

  async head(key: string): Promise<MediaObject | null> {
    const full = this.resolve(key);
    if (!full) return null;
    try {
      const info = await stat(full);
      if (!info.isFile()) return null;
      const contentType = CONTENT_TYPES[path.extname(full)] ?? 'application/octet-stream';
      return { size: info.size, contentType };
    } catch {
      return null;
    }
  }

  read(key: string, range?: { start: number; end: number }): Readable {
    const full = this.resolve(key);
    if (!full) throw new Error('Invalid media key');
    return createReadStream(full, range);
  }
}
