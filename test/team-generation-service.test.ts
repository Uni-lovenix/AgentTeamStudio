import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PersistenceService } from '../src/services/persistence-service';
import { SettingsService, SecretStore } from '../src/services/settings-service';
import { LlmClient } from '../src/services/llm-client';
import { TeamGenerationService } from '../src/services/team-generation-service';
import { buildTeamConfig } from '../src/services/requirement-analyzer';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-generation-'));
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
  vi.restoreAllMocks();
});

function createService(): TeamGenerationService {
  const persistence = new PersistenceService(path.join(makeTempDir(), 'data'));
  const settings = new SettingsService(persistence, new FakeSecretStore());
  return new TeamGenerationService(new LlmClient(), settings);
}

describe('team-generation-service', () => {
  it('generates locally when LLM is not requested', async () => {
    const service = createService();
    const result = await service.generate({
      projectName: 'CLI Tool',
      requirement: '一个命令行工具，支持任务清单和进度跟踪。',
    });

    expect(result.team.generatedBy).toBe('local');
    expect(result.llmAttempted).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it('falls back to local generation when the LLM call fails', async () => {
    const persistence = new PersistenceService(path.join(makeTempDir(), 'data'));
    const settings = new SettingsService(persistence, new FakeSecretStore());
    settings.save({
      llm: {
        enabled: true,
        baseUrl: 'https://example.com/v1',
        model: 'test-model',
        protocol: 'openai',
      },
      apiKey: 'secret',
    });
    const client = new LlmClient();
    vi.spyOn(client, 'generateTeam').mockRejectedValue(new Error('network down'));
    const service = new TeamGenerationService(client, settings);

    const result = await service.generate({
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
      useLlm: true,
    });

    expect(result.team.generatedBy).toBe('local');
    expect(result.llmAttempted).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('network down'))).toBe(true);
  });

  it('keeps an LLM result when generation succeeds', async () => {
    const persistence = new PersistenceService(path.join(makeTempDir(), 'data'));
    const settings = new SettingsService(persistence, new FakeSecretStore());
    settings.save({
      llm: {
        enabled: true,
        baseUrl: 'https://example.com/v1',
        model: 'test-model',
        protocol: 'openai',
      },
      apiKey: 'secret',
    });
    const client = new LlmClient();
    const local = buildTeamConfig({
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });
    vi.spyOn(client, 'generateTeam').mockResolvedValue({
      ...local,
      generatedBy: 'llm',
      projectName: 'From LLM',
    });
    const service = new TeamGenerationService(client, settings);

    const result = await service.generate({
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
      useLlm: true,
    });

    expect(result.team.generatedBy).toBe('llm');
    expect(result.team.projectName).toBe('From LLM');
    expect(result.warnings).toEqual([]);
  });

  it('rejects a short requirement', async () => {
    const service = createService();
    await expect(
      service.generate({ requirement: '太短' })
    ).rejects.toThrow(/10 个字符/);
  });
});
