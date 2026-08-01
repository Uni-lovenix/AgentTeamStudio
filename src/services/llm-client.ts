import { ConnectionTestResult, GenerateTeamInput, TeamConfig } from '../shared/types';
import { LlmClientSettings } from './settings-service';
import { normalizeTeamConfig } from './requirement-analyzer';
import { logger } from './logger';

const SERVICE = 'llm-client';

function extractJson(content: string): unknown {
  const cleaned = content
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('LLM 响应中没有可解析的 JSON 对象');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export class LlmClient {
  private log = logger.forService(SERVICE);

  async generateTeam(settings: LlmClientSettings, input: GenerateTeamInput): Promise<TeamConfig> {
    if (!settings.apiKey) {
      throw new Error('未配置 API Key');
    }
    const startedAt = Date.now();
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              '你是多智能体团队设计器。只输出 JSON，不要输出 Markdown 或解释。JSON 必须包含 schemaVersion、projectName、workflow、agents、conventions 字段。agents 数组中的每个角色必须包含 id、name、mission、responsibilities、skills、tools、deliverables、dependsOn、notifies。',
          },
          {
            role: 'user',
            content: `项目名称：${input.projectName || '未命名项目'}\n技术栈提示：${input.techStackHints || '未指定'}\n需求描述：${input.requirement}\n\n请设计一个适合这个项目的多智能体团队。`,
          },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM 请求失败 (${response.status}): ${body.slice(0, 300)}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 响应缺少 choices[0].message.content');
    }
    const raw = extractJson(content);
    const team = normalizeTeamConfig(raw, input);
    this.log.info('LLM generated team', {
      durationMs: Date.now() - startedAt,
      agentCount: team.agents.length,
    });
    return team;
  }

  async testConnection(settings: LlmClientSettings): Promise<ConnectionTestResult> {
    const startedAt = Date.now();
    if (!settings.apiKey) {
      throw new Error('未配置 API Key');
    }
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return {
        ok: false,
        message: `连接失败 (${response.status})`,
        latencyMs,
      };
    }
    return {
      ok: true,
      message: '连接成功',
      latencyMs,
    };
  }
}
