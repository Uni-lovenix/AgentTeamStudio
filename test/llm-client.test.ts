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
      {
        enabled: true,
        baseUrl: 'https://example.com/v1',
        model: 'test',
        protocol: 'openai',
        apiKey: 'secret',
      },
      { requirement: '一个命令行工具，用于管理任务。' }
    );

    expect(team.projectName).toBe('LLM Project');
    expect(team.agents.some((agent) => agent.name === '开发者')).toBe(true);
    expect(team.agents.some((agent) => agent.name === '规划者')).toBe(true);
    expect(team.agents.some((agent) => agent.name === '评估者')).toBe(true);
    expect(team.workflow[0].name).toContain('冲刺协议');
    expect(team.workflow.some((step) => step.name.includes('评估与反馈'))).toBe(true);
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
        {
          enabled: true,
          baseUrl: 'https://example.com/v1',
          model: 'test',
          protocol: 'openai',
          apiKey: 'secret',
        },
        { requirement: '一个命令行工具，用于管理任务。' }
      )
    ).rejects.toThrow(/JSON/);
  });

  it('calls Anthropic /v1/messages and parses content blocks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        content: [{ type: 'text', text: `Here is the team:\n\`\`\`json\n${JSON.stringify(validPayload)}\n\`\`\`` }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = new LlmClient();
    const team = await client.generateTeam(
      {
        enabled: true,
        baseUrl: 'https://api.minimaxi.com/anthropic',
        model: 'MiniMax-M2.7-highspeed',
        protocol: 'anthropic',
        apiKey: 'secret',
      },
      { requirement: '一个命令行工具，用于管理任务。' }
    );

    expect(team.projectName).toBe('LLM Project');
    expect(team.agents.some((agent) => agent.name === '开发者')).toBe(true);
    expect(team.agents.some((agent) => agent.name === '规划者')).toBe(true);
    expect(team.agents.some((agent) => agent.name === '评估者')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.minimaxi.com/anthropic/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.max_tokens).toBe(4096);
    expect(body.system).toContain('多智能体团队设计器');
  });

  it('returns a connection failure result instead of rejecting on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const client = new LlmClient();

    const result = await client.testConnection({
      enabled: true,
      baseUrl: 'https://example.com/v1',
      model: 'test',
      protocol: 'openai',
      apiKey: 'secret',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('network down');
  });

  it('returns a clear failure result when no API key is configured', async () => {
    const client = new LlmClient();

    const result = await client.testConnection({
      enabled: true,
      baseUrl: 'https://example.com/v1',
      model: 'test',
      protocol: 'openai',
    });

    expect(result).toEqual({
      ok: false,
      message: '未配置 API Key',
      latencyMs: 0,
    });
  });
});
