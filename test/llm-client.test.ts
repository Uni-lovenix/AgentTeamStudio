import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmClient } from '../src/services/llm-client';

const validPayload = {
  schemaVersion: 1,
  projectName: 'LLM Project',
  workflow: [],
  agents: [
    {
      id: 'a1',
      name: '开发者',
      mission: '实现功能',
      responsibilities: ['写代码'],
      skills: [],
      tools: [],
      deliverables: [],
      dependsOn: [],
      notifies: [],
    },
  ],
  conventions: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('llm-client', () => {
  it('parses JSON from an OpenAI-compatible response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({
          choices: [{ message: { content: `Here is the team:\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\`` } }],
        }),
      })
    );
    const client = new LlmClient();
    const team = await client.generateTeam(
      { enabled: true, baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'secret' },
      { requirement: '一个命令行工具，用于管理任务。' }
    );

    expect(team.projectName).toBe('LLM Project');
    expect(team.agents[0].name).toBe('开发者');
  });

  it('throws when the response contains no JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ choices: [{ message: { content: 'no json here' } }] }),
      })
    );
    const client = new LlmClient();
    await expect(
      client.generateTeam(
        { enabled: true, baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'secret' },
        { requirement: '一个命令行工具，用于管理任务。' }
      )
    ).rejects.toThrow(/JSON/);
  });
});
