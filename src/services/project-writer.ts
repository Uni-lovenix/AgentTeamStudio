import * as fs from 'fs';
import * as path from 'path';
import { AgentRole, TeamConfig, WriteTeamResult } from '../shared/types';
import { logger } from './logger';

const SERVICE = 'project-writer';

export const TEAM_RULES_FILENAME = 'AGENTS.team.md';
export const AGENTS_JSON_FILENAME = 'agents.json';
export const AGENTS_DIRECTORY = 'agents';
export const CLAUDE_RULES_FILENAME = 'CLAUDE.md';
export const CODEX_RULES_FILENAME = 'AGENTS.md';
export const AGENT_RULES_FILENAMES = [
  CLAUDE_RULES_FILENAME,
  CODEX_RULES_FILENAME,
] as const;
const COLLABORATION_POINTER =
  '协作流程：规划者每项任务开始前制定冲刺协议，开发者按协议开发，评估者按协议校验并反馈给开发者修改。';

export interface TargetInspection {
  directoryExists: boolean;
  existingFiles: string[];
  existingRuleFiles: string[];
}

function bulletItems(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function bulletOrNone(items: string[]): string {
  return bulletItems(items) || '- 无';
}

function collaborationRule(agent: AgentRole): string {
  if (agent.name === '规划者') {
    return '- 每项任务开始前制定冲刺协议，明确任务拆解、目标、范围、完成标准、验收方式和交付物。';
  }
  if (agent.name === '评估者') {
    return '- 按冲刺协议校验开发者交付；发现问题反馈给对应开发者修改，并复核到通过。';
  }
  if (agent.name.includes('开发者')) {
    return '- 按规划者制定的冲刺协议开发；收到评估者反馈后修改并提交复核。';
  }
  return '- 按冲刺协议完成职责，接受评估者校验并按反馈修改。';
}

function safeAgentFileName(agent: AgentRole, index: number): string {
  const base =
    agent.name
      .trim()
      .replace(/[\\/:*?"<>|#%{}~^[\]]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 80) || `agent-${index + 1}`;
  return `${String(index + 1).padStart(2, '0')}-${base}.md`;
}

export function renderAgentMarkdown(agent: AgentRole, team: TeamConfig): string {
  const ownedSteps =
    team.workflow
      .filter((step) => step.ownerRoleId === agent.id)
      .map((step, index) => `${index + 1}. **${step.name}**：${step.description}`)
      .join('\n') || '- 未分配独立协作步骤。';

  return `# ${agent.name}

> 本文件由 Agent Team Studio 生成。

## 使命

${agent.mission}

## 职责

${bulletOrNone(agent.responsibilities)}

## 技能

${bulletOrNone(agent.skills)}

## 工具

${bulletOrNone(agent.tools)}

## 交付物

${bulletOrNone(agent.deliverables)}

## 依赖角色

${bulletOrNone(agent.dependsOn)}

## 通知角色

${bulletOrNone(agent.notifies)}

## 协作规则

${collaborationRule(agent)}

## 协作流程

${ownedSteps}
`;
}

function agentFileEntries(team: TeamConfig): Array<{ filename: string; content: string }> {
  return team.agents.map((agent, index) => ({
    filename: `${AGENTS_DIRECTORY}/${safeAgentFileName(agent, index)}`,
    content: renderAgentMarkdown(agent, team),
  }));
}

export function renderTeamMarkdown(team: TeamConfig): string {
  const agentRoutingSections = team.agents
    .map(
      (agent, index) =>
        `- ${agent.name}：读取 \`agents/${safeAgentFileName(agent, index)}\`，严格遵守该文件中的使命、职责、技能、工具和交付物。`
    )
    .join('\n');

  const workflowSections = team.workflow
    .map(
      (step) => `1. **${step.name}**：${step.description}（负责人：${team.agents.find((agent) => agent.id === step.ownerRoleId)?.name ?? '待分配'}）`
    )
    .join('\n');

  return `# ${team.projectName} 智能体团队

> 本文件由 Agent Team Studio 生成，供多智能体协作开发使用。

## 项目需求

${team.requirement}

技术栈提示：${team.techStackHints.join('、') || '未指定'}

生成方式：${team.generatedBy === 'llm' ? 'LLM 辅助生成' : '需求驱动生成'}

## 冲刺协议

每项任务开始前，规划者必须制定冲刺协议，包含任务目标、范围、任务拆解、完成标准、验收方式和交付物。开发者按协议开发；评估者按协议校验，发现问题反馈给对应开发者修改；通过后进入下一任务或最终验收。

## 智能体路由

每个智能体开始工作前，必须读取与自身角色对应的文件；其他角色的规则文件不需要加载。

${agentRoutingSections}

## 协作流程

${workflowSections}

## 工程约定

- 分支：${team.conventions.branch}
- 提交：${team.conventions.commits}
- Pull Request：${team.conventions.pullRequests}
- 测试：${team.conventions.testing}
- 文档：${team.conventions.documentation}
`;
}

function renderTeamPointer(): string {
  return `使用智能体规则在 ${TEAM_RULES_FILENAME} 文件`;
}

function appendTeamRulesIfMissing(absolutePath: string): boolean {
  if (!fs.existsSync(absolutePath)) return false;
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const needsPointer = !content.includes(renderTeamPointer());
  const needsCollaboration = !content.includes(COLLABORATION_POINTER);
  if (!needsPointer && !needsCollaboration) return false;
  const additions: string[] = [];
  if (needsPointer) {
    additions.push(`## Agent Team Studio\n\n${renderTeamPointer()}`);
  }
  if (needsCollaboration) {
    additions.push(COLLABORATION_POINTER);
  }
  const nextContent = `${content.replace(/\s+$/, '')}\n\n${additions.join('\n\n')}\n`;
  const tempPath = `${absolutePath}.tmp`;
  fs.writeFileSync(tempPath, nextContent, 'utf-8');
  fs.renameSync(tempPath, absolutePath);
  return true;
}

export class ProjectWriter {
  private log = logger.forService(SERVICE);

  inspectTarget(targetDirectory: string): TargetInspection {
    const absolute = path.resolve(targetDirectory);
    const directoryExists = fs.existsSync(absolute) && fs.statSync(absolute).isDirectory();
    const existingFiles: string[] = [];
    const existingRuleFiles = directoryExists
      ? AGENT_RULES_FILENAMES.filter((filename) => fs.existsSync(path.join(absolute, filename)))
      : [];
    if (directoryExists) {
      for (const filename of [TEAM_RULES_FILENAME, AGENTS_JSON_FILENAME]) {
        if (fs.existsSync(path.join(absolute, filename))) {
          existingFiles.push(filename);
        }
      }
      if (fs.existsSync(path.join(absolute, AGENTS_DIRECTORY))) {
        existingFiles.push(`${AGENTS_DIRECTORY}/`);
      }
    }
    return { directoryExists, existingFiles, existingRuleFiles };
  }

  writeToDirectory(
    team: TeamConfig,
    targetDirectory: string,
    overwrite: boolean
  ): WriteTeamResult {
    const absolute = path.resolve(targetDirectory);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
      throw new Error(`目标目录不存在或不是文件夹：${absolute}`);
    }
    const existing = this.inspectTarget(absolute).existingFiles;
    if (existing.length > 0 && !overwrite) {
      throw new Error(`目标目录已存在需要覆盖的文件：${existing.join('、')}`);
    }

    const files = [
      { filename: TEAM_RULES_FILENAME, content: renderTeamMarkdown(team) },
      { filename: AGENTS_JSON_FILENAME, content: `${JSON.stringify(team, null, 2)}\n` },
      ...agentFileEntries(team),
    ];
    const createdFiles: string[] = [];
    const overwrittenFiles: string[] = [];
    fs.mkdirSync(path.join(absolute, AGENTS_DIRECTORY), { recursive: true });
    for (const file of files) {
      const fullPath = path.join(absolute, file.filename);
      const existed = fs.existsSync(fullPath);
      const tempPath = `${fullPath}.tmp`;
      fs.writeFileSync(tempPath, file.content, 'utf-8');
      fs.renameSync(tempPath, fullPath);
      if (existed) {
        overwrittenFiles.push(file.filename);
      } else {
        createdFiles.push(file.filename);
      }
    }
    const appendedFiles: string[] = [];
    for (const filename of AGENT_RULES_FILENAMES) {
      const rulePath = path.join(absolute, filename);
      if (appendTeamRulesIfMissing(rulePath)) {
        appendedFiles.push(filename);
      }
    }
    this.log.info('Wrote team config to project directory', {
      targetDirectory: absolute,
      createdFiles,
      overwrittenFiles,
      appendedFiles,
    });
    return {
      targetDirectory: absolute,
      createdFiles,
      overwrittenFiles,
      appendedFiles,
    };
  }
}
