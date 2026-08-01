import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PersistenceService } from '../src/services/persistence-service';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-persistence-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('persistence-service', () => {
  it('writes, reads, and resets JSON data', () => {
    const dataDir = path.join(makeTempDir(), 'data');
    const persistence = new PersistenceService(dataDir);
    persistence.writeJson('projects.json', [{ id: 'p1' }]);

    expect(persistence.readJson<Array<{ id: string }>>('projects.json')).toEqual([{ id: 'p1' }]);
    expect(persistence.exists('projects.json')).toBe(true);

    persistence.resetAll();
    expect(persistence.exists('projects.json')).toBe(false);
  });

  it('returns null for missing or invalid JSON', () => {
    const dataDir = path.join(makeTempDir(), 'data');
    const persistence = new PersistenceService(dataDir);
    expect(persistence.readJson('missing.json')).toBeNull();

    fs.writeFileSync(path.join(dataDir, 'broken.json'), '{bad json', 'utf-8');
    expect(persistence.readJson('broken.json')).toBeNull();
  });
});
