import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PersistenceService } from '../src/services/persistence-service';
import {
  SecretStore,
  SettingsService,
} from '../src/services/settings-service';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-settings-'));
  tempDirs.push(dir);
  return dir;
}

class FakeSecretStore implements SecretStore {
  isEncryptionAvailable(): boolean {
    return true;
  }

  encryptString(value: string): string {
    return `enc:${Buffer.from(value, 'utf-8').toString('base64')}`;
  }

  decryptString(encoded: string): string {
    return Buffer.from(encoded.slice(4), 'base64').toString('utf-8');
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('settings-service', () => {
  it('encrypts and preserves an API key without returning it in snapshots', () => {
    const persistence = new PersistenceService(path.join(makeTempDir(), 'data'));
    const service = new SettingsService(persistence, new FakeSecretStore());

    const snapshot = service.save({
      llm: {
        enabled: true,
        baseUrl: 'https://example.com/v1',
        model: 'test-model',
        protocol: 'openai',
      },
      apiKey: 'secret-value',
    });

    expect(snapshot.hasApiKey).toBe(true);
    expect(snapshot.llm.enabled).toBe(true);
    expect(snapshot.llm.protocol).toBe('openai');
    expect(service.getClientSettings().apiKey).toBe('secret-value');
    expect(JSON.stringify(persistence.readJson('settings.json'))).not.toContain('secret-value');
  });

  it('can clear a stored key', () => {
    const persistence = new PersistenceService(path.join(makeTempDir(), 'data'));
    const service = new SettingsService(persistence, new FakeSecretStore());
    service.save({
      llm: {
        enabled: false,
        baseUrl: 'https://example.com/v1',
        model: 'test-model',
        protocol: 'openai',
      },
      apiKey: 'secret-value',
    });

    const snapshot = service.save({
      llm: {
        enabled: false,
        baseUrl: 'https://example.com/v1',
        model: 'test-model',
        protocol: 'openai',
      },
      clearApiKey: true,
    });

    expect(snapshot.hasApiKey).toBe(false);
    expect(service.getClientSettings().apiKey).toBeUndefined();
  });

  it('migrates legacy settings by inferring the protocol from the base URL', () => {
    const persistence = new PersistenceService(path.join(makeTempDir(), 'data'));
    persistence.writeJson('settings.json', {
      llm: {
        enabled: true,
        baseUrl: 'https://api.minimaxi.com/anthropic',
        model: 'MiniMax-M2.7-highspeed',
      },
    });
    const service = new SettingsService(persistence, new FakeSecretStore());

    const snapshot = service.getSnapshot();

    expect(snapshot.llm.protocol).toBe('anthropic');
    expect(service.getClientSettings().baseUrl).toBe('https://api.minimaxi.com/anthropic');
  });
});
