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
  '协作流程：规划者每个迭代开始前制定迭代协议，开发者按迭代协议开发，评估者按迭代协议校验并反馈给开发者修改。';
const LEGACY_COLLABORATION_POINTERS = [
  '协作流程：规划者每项任务开始前制定冲刺协议，开发者按协议开发，评估者按协议校验并反馈给开发者修改。',
  '协作流程：规划者每个迭代开始前制定冲刺协议，开发者按迭代协议开发，评估者按迭代协议校验并反馈给开发者修改。',
];

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
    return '- 每个迭代开始前制定迭代协议，明确目标、范围、计划、交付物和退出标准。';
  }
  if (agent.name === '评估者') {
    return '- 按迭代协议和退出标准校验开发者交付；发现问题反馈给对应开发者修改，并复核到通过。';
  }
  if (agent.name.includes('开发者')) {
    return '- 按规划者制定的迭代协议开发；收到评估者反馈后修改并提交复核。';
  }
  return '- 按迭代协议完成职责，接受评估者校验并按反馈修改。';
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

  const processSections = team.processManagement.phases
    .map((phase) => {
      const phaseIterations = team.processManagement.iterations.filter((iteration) =>
        phase.iterationIds.includes(iteration.id)
      );
      const iterationList = phaseIterations
        .map((iteration) => {
          const owner =
            team.agents.find((agent) => agent.id === iteration.ownerRoleId)?.name ??
            '待分配';
          return `- **${iteration.name}**（${iteration.status}，负责人：${owner}）：${iteration.objective}`;
        })
        .join('\n');
      return `### ${phase.name}阶段\n\n里程碑：${phase.milestone}\n\n目标：${phase.goals.join('；')}\n\n交付物：${phase.deliverables.join('、')}\n\n退出标准：${phase.exitCriteria.join('；')}\n\n迭代：\n${iterationList || '- 无'}`;
    })
    .join('\n\n');

  return `# ${team.projectName} 智能体团队

> 本文件由 Agent Team Studio 生成，供多智能体协作开发使用。

## 项目需求

${team.requirement}

技术栈提示：${team.techStackHints.join('、') || '未指定'}

生成方式：${team.generatedBy === 'llm' ? 'LLM 辅助生成' : '需求驱动生成'}

## RUP 过程管理

项目按启动、细化、构建、移交四个 RUP 阶段推进；每个阶段有里程碑和退出标准，每个迭代开始前由规划者制定迭代协议，开发者按迭代协议开发，评估者按退出标准校验并反馈给对应开发者修改；阶段未达退出标准时不得进入下一阶段。

当前阶段：${team.processManagement.currentPhaseId}

${processSections}

## 迭代协议

每个迭代开始前，规划者必须制定迭代协议，包含迭代目标、范围、计划、交付物和退出标准。开发者按迭代协议开发；评估者按迭代协议校验，发现问题反馈给对应开发者修改；通过后进入下一迭代、阶段验收或最终移交。

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
  const originalContent = fs.readFileSync(absolutePath, 'utf-8');
  let content = originalContent;
  for (const legacyPointer of LEGACY_COLLABORATION_POINTERS) {
    content = content.split(legacyPointer).join(COLLABORATION_POINTER);
  }
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
  return content !== originalContent || needsPointer || needsCollaboration;
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
