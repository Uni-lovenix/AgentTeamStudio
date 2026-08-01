import { LlmSettings, SaveSettingsInput, SettingsSnapshot } from '../shared/types';
import { PersistenceService } from './persistence-service';
import { logger } from './logger';

const SERVICE = 'settings-service';

export interface SecretStore {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): string;
  decryptString(encoded: string): string;
}

export interface LlmClientSettings extends LlmSettings {
  apiKey?: string;
}

interface StoredSettings {
  llm: {
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKeyEncrypted?: string;
  };
}

const DEFAULT_SETTINGS: StoredSettings = {
  llm: {
    enabled: false,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
};

export class SettingsService {
  private log = logger.forService(SERVICE);

  constructor(
    private persistence: PersistenceService,
    private secretStore: SecretStore
  ) {}

  private read(): StoredSettings {
    const stored = this.persistence.readJson<StoredSettings>('settings.json');
    if (!stored?.llm) return { ...DEFAULT_SETTINGS };
    return {
      llm: {
        ...DEFAULT_SETTINGS.llm,
        ...stored.llm,
      },
    };
  }

  private write(settings: StoredSettings): void {
    this.persistence.writeJson('settings.json', settings);
  }

  getSnapshot(): SettingsSnapshot {
    const stored = this.read();
    this.log.debug('Read settings snapshot', {
      enabled: stored.llm.enabled,
      hasApiKey: Boolean(stored.llm.apiKeyEncrypted),
    });
    return {
      llm: {
        enabled: stored.llm.enabled,
        baseUrl: stored.llm.baseUrl,
        model: stored.llm.model,
      },
      hasApiKey: Boolean(stored.llm.apiKeyEncrypted),
    };
  }

  getClientSettings(): LlmClientSettings {
    const stored = this.read();
    const settings: LlmClientSettings = {
      enabled: stored.llm.enabled,
      baseUrl: stored.llm.baseUrl,
      model: stored.llm.model,
    };
    if (stored.llm.apiKeyEncrypted) {
      try {
        settings.apiKey = this.secretStore.decryptString(stored.llm.apiKeyEncrypted);
      } catch (err) {
        this.log.error('Failed to decrypt API key', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return settings;
  }

  save(input: SaveSettingsInput): SettingsSnapshot {
    if (!/^https?:\/\//i.test(input.llm.baseUrl)) {
      throw new Error('Base URL 必须以 http:// 或 https:// 开头');
    }
    if (!input.llm.model.trim()) {
      throw new Error('模型名称不能为空');
    }
    const stored = this.read();
    const next: StoredSettings = {
      llm: {
        enabled: input.llm.enabled,
        baseUrl: input.llm.baseUrl.trim(),
        model: input.llm.model.trim(),
      },
    };
    if (input.clearApiKey) {
      next.llm.apiKeyEncrypted = undefined;
    } else if (input.apiKey?.trim()) {
      if (!this.secretStore.isEncryptionAvailable()) {
        throw new Error('当前系统不支持加密保存 API Key');
      }
      next.llm.apiKeyEncrypted = this.secretStore.encryptString(input.apiKey.trim());
    } else if (stored.llm.apiKeyEncrypted) {
      next.llm.apiKeyEncrypted = stored.llm.apiKeyEncrypted;
    }
    this.write(next);
    this.log.info('Saved settings', {
      enabled: next.llm.enabled,
      hasApiKey: Boolean(next.llm.apiKeyEncrypted),
    });
    return this.getSnapshot();
  }

  reset(): void {
    this.write({ ...DEFAULT_SETTINGS });
    this.log.info('Reset settings to defaults');
  }
}
