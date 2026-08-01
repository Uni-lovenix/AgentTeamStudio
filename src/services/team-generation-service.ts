import {
  GenerateTeamInput,
  GenerateTeamResult,
  GenerationLogEntry,
} from '../shared/types';
import { buildTeamConfig } from './requirement-analyzer';
import { LlmClient } from './llm-client';
import { SettingsService } from './settings-service';
import { logger } from './logger';

const SERVICE = 'team-generation-service';

export class TeamGenerationService {
  private log = logger.forService(SERVICE);

  constructor(
    private llmClient: LlmClient,
    private settingsService: SettingsService
  ) {}

  async generate(input: GenerateTeamInput): Promise<GenerateTeamResult> {
    const requirement = input.requirement.trim();
    if (!requirement) {
      throw new Error('需求描述不能为空');
    }
    if (requirement.length < 10) {
      throw new Error('需求描述至少需要 10 个字符');
    }

    const warnings: string[] = [];
    let team = buildTeamConfig(input);
    let llmAttempted = false;

    if (input.useLlm) {
      const clientSettings = this.settingsService.getClientSettings();
      if (!clientSettings.apiKey) {
        warnings.push('未配置 API Key，本次使用需求驱动生成。');
        team = {
          ...team,
          generationLog: [
            ...(team.generationLog ?? []),
            {
              step: '生成方式',
              detail: '未配置 API Key，所以本次生成直接使用本地需求驱动。',
              evidence: 'LLM 未启用',
              outcome: `生成角色：${team.agents.map((agent) => agent.name).join('、')}`,
            } satisfies GenerationLogEntry,
          ],
        };
      } else {
        llmAttempted = true;
        try {
          team = await this.llmClient.generateTeam(clientSettings, input);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          warnings.push(`LLM 生成失败，已回退到需求驱动生成：${message}`);
          team = {
            ...team,
            generationLog: [
              ...(team.generationLog ?? []),
              {
                step: 'LLM 回退',
                detail: `LLM 调用失败（${message}），重新运行需求驱动生成。`,
                evidence: message,
                outcome: `回退角色：${team.agents.map((agent) => agent.name).join('、')}`,
              } satisfies GenerationLogEntry,
            ],
          };
          this.log.warn('LLM generation failed, falling back to local template', {
            error: message,
          });
        }
      }
    }

    this.log.info('Team generated', {
      source: team.generatedBy,
      agentCount: team.agents.length,
      llmAttempted,
    });
    return { team, warnings, llmAttempted };
  }
}
