import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

const SERVICE = 'persistence';

export class PersistenceService {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.ensureDirectories();
    logger.info(SERVICE, 'PersistenceService initialized', { dataDir });
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
      logger.debug(SERVICE, 'Created data directory', { dataDir: this.dataDir });
    }
  }

  readJson<T>(relativePath: string): T | null {
    const fullPath = path.join(this.dataDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      logger.debug(SERVICE, 'JSON file not found', { relativePath });
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as T;
      logger.debug(SERVICE, 'Read JSON file', { relativePath });
      return parsed;
    } catch (err) {
      logger.error(SERVICE, 'Failed to parse JSON file', {
        relativePath,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  writeJson<T>(relativePath: string, data: T): void {
    const fullPath = path.join(this.dataDir, relativePath);
    const tempPath = `${fullPath}.tmp`;
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const payload = `${JSON.stringify(data, null, 2)}\n`;
    fs.writeFileSync(tempPath, payload, 'utf-8');
    fs.renameSync(tempPath, fullPath);
    logger.debug(SERVICE, 'Wrote JSON file', {
      relativePath,
      sizeBytes: Buffer.byteLength(payload),
    });
  }

  exists(relativePath: string): boolean {
    return fs.existsSync(path.join(this.dataDir, relativePath));
  }

  resetAll(): void {
    logger.warn(SERVICE, 'Resetting application data', { dataDir: this.dataDir });
    fs.rmSync(this.dataDir, { recursive: true, force: true });
    this.ensureDirectories();
    logger.info(SERVICE, 'Application data reset complete');
  }
}
