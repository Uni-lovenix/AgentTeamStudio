import { ConnectionTestResult, GenerateTeamInput, TeamConfig } from '../shared/types';
import { LlmClientSettings } from './settings-service';
import { normalizeTeamConfig } from './requirement-analyzer';
import { logger } from './logger';

const SERVICE = 'llm-client';
const SYSTEM_PROMPT =
  '你是多智能体团队设计器。先分析需求的目标、用户、核心业务过程和约束，识别完成需求必须承担的责任区块，再据此生成团队。团队必须包含“规划者”和“评估者”：规划者负责任务分解、制定方案、流程协调，并在每个迭代开始前制定迭代协议；评估者按迭代协议校验开发者结果，发现问题反馈给开发者修改。每个责任区块对应一个开发者角色，开发者可以有多个。不要按前端、后端、数据库等实现功能拆分角色，也不要把需求功能模块直接当成角色，不要生成架构师、测试、部署或项目经理等额外 RUP 角色。过程管理采用轻量 RUP：启动、细化、构建、移交四个阶段，每个阶段有里程碑和退出标准，每个迭代有目标、范围、计划、交付物、退出标准和反馈目标。只输出 JSON，不要输出 Markdown 或解释。JSON 必须包含 schemaVersion、projectName、workflow、processManagement、agents、conventions 字段。agents 数组中的每个角色必须包含 id、name、mission、responsibilities、skills、tools、deliverables、dependsOn、notifies。processManagement 必须包含 framework="rup"、currentPhaseId="inception"、phases 四个阶段、iterations 至少四个迭代；每个 phase 必须包含 id、name、purpose、goals、deliverables、milestone、exitCriteria、ownerRoleId、iterationIds；每个 iteration 必须包含 id、phaseId、name、objective、scope、plan、exitCriteria、deliverables、ownerRoleId、feedbackTargetRoleId、status。workflow 必须包含项目启动、制定迭代协议、迭代开发、评估与反馈、迭代复盘、阶段验收、移交验收步骤。';

function buildUserPrompt(input: GenerateTeamInput): string {
  return `项目名称：${input.projectName || '未命名项目'}\n技术栈提示：${input.techStackHints || '未指定'}\n需求描述：${input.requirement}\n\n请设计一个适合这个项目的多智能体团队。\n规则：1. 从需求中识别完成项目必须承担的责任区块；2. 团队必须包含“规划者”和“评估者”，每个责任区块对应一个或多个开发者角色；3. 每个迭代开始前，规划者制定迭代协议，开发者按协议开发，评估者按协议校验并反馈给开发者修改；4. 为每个角色写具体职责，不要输出空职责；5. 不要只按前端、后端、数据库等实现功能拆分角色；6. 过程管理使用轻量 RUP 的启动、细化、构建、移交四阶段，不生成额外 RUP 角色；7. 输出 processManagement 和上述 RUP 工作流。`;
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
