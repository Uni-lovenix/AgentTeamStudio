import { ConnectionTestResult, GenerateTeamInput, TeamConfig } from '../shared/types';
import { LlmClientSettings } from './settings-service';
import { normalizeTeamConfig } from './requirement-analyzer';
import { logger } from './logger';

const SERVICE = 'llm-client';
const SYSTEM_PROMPT =
  '你是多智能体团队设计器。只输出 JSON，不要输出 Markdown 或解释。JSON 必须包含 schemaVersion、projectName、workflow、agents、conventions 字段。agents 数组中的每个角色必须包含 id、name、mission、responsibilities、skills、tools、deliverables、dependsOn、notifies。';

function buildUserPrompt(input: GenerateTeamInput): string {
  return `项目名称：${input.projectName || '未命名项目'}\n技术栈提示：${input.techStackHints || '未指定'}\n需求描述：${input.requirement}\n\n请设计一个适合这个项目的多智能体团队。`;
}

function endpointFor(settings: LlmClientSettings): string {
  const base = settings.baseUrl.replace(/\/$/, '');
  if (settings.protocol === 'anthropic') {
    if (/\/v1\/messages$/i.test(base)) return base;
    if (/\/v1$/i.test(base)) return `${base}/messages`;
    return `${base}/v1/messages`;
  }
  return `${base}/chat/completions`;
}

function headersFor(settings: LlmClientSettings): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${settings.apiKey}`,
  };
  if (settings.protocol === 'anthropic' && settings.apiKey) {
    headers['x-api-key'] = settings.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  }
  return headers;
}

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

function extractAnthropicText(payload: {
  content?: Array<{ type?: string; text?: string }>;
}): string {
  const textBlocks = (payload.content ?? []).filter(
    (block): block is { type: 'text'; text: string } =>
      block.type === 'text' && typeof block.text === 'string'
  );
  const text = textBlocks.map((block) => block.text).join('\n').trim();
  if (!text) {
    throw new Error('Anthropic 响应中没有文本内容');
  }
  return text;
}

export class LlmClient {
  private log = logger.forService(SERVICE);

  async generateTeam(settings: LlmClientSettings, input: GenerateTeamInput): Promise<TeamConfig> {
    if (!settings.apiKey) {
      throw new Error('未配置 API Key');
    }
    const startedAt = Date.now();
    const body =
      settings.protocol === 'anthropic'
        ? {
            model: settings.model,
            max_tokens: 4096,
            temperature: 0.2,
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildUserPrompt(input) }],
          }
        : {
            model: settings.model,
            temperature: 0.2,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildUserPrompt(input) },
            ],
          };
    const response = await fetch(endpointFor(settings), {
      method: 'POST',
      headers: headersFor(settings),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`LLM 请求失败 (${response.status}): ${body.slice(0, 300)}`);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: Array<{ type?: string; text?: string }>;
    };
    const content =
      settings.protocol === 'anthropic'
        ? extractAnthropicText(payload)
        : payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('LLM 响应缺少 choices[0].message.content');
    }
    const raw = extractJson(content);
    const team = normalizeTeamConfig(raw, input);
    this.log.info('LLM generated team', {
      durationMs: Date.now() - startedAt,
      agentCount: team.agents.length,
      protocol: settings.protocol,
    });
    return team;
  }

  async testConnection(settings: LlmClientSettings): Promise<ConnectionTestResult> {
    const startedAt = Date.now();
    if (!settings.apiKey) {
      return { ok: false, message: '未配置 API Key', latencyMs: 0 };
    }
    let response: Response;
    try {
      const body =
        settings.protocol === 'anthropic'
          ? {
              model: settings.model,
              max_tokens: 16,
              messages: [{ role: 'user', content: 'ping' }],
            }
          : {
              model: settings.model,
              max_tokens: 1,
              messages: [{ role: 'user', content: 'ping' }],
            };
      response = await fetch(endpointFor(settings), {
        method: 'POST',
        headers: headersFor(settings),
        body: JSON.stringify(body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.warn('LLM connection test failed', {
        error: message,
        protocol: settings.protocol,
      });
      return {
        ok: false,
        message: `连接失败：${message}`,
        latencyMs: Date.now() - startedAt,
      };
    }
    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        detail = '';
      }
      return {
        ok: false,
        message: `连接失败 (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`,
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
