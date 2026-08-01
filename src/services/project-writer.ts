import * as fs from 'fs';
import * as path from 'path';
import { TeamConfig, WriteTeamResult } from '../shared/types';
import { logger } from './logger';

const SERVICE = 'project-writer';

export interface TargetInspection {
  directoryExists: boolean;
  existingFiles: string[];
}

function bulletItems(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function renderAgentsMarkdown(team: TeamConfig): string {
  const roleSections = team.agents
    .map(
      (agent) => `### ${agent.name}

使命：${agent.mission}

职责：
${bulletItems(agent.responsibilities)}

技能：${agent.skills.join('、') || '未指定'}

工具：${agent.tools.join('、') || '未指定'}

交付物：
${bulletItems(agent.deliverables)}

依赖角色：${agent.dependsOn.join('、') || '无'}

通知角色：${agent.notifies.join('、') || '无'}
`
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

## 团队角色

${roleSections}
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

export class ProjectWriter {
  private log = logger.forService(SERVICE);

  inspectTarget(targetDirectory: string): TargetInspection {
    const absolute = path.resolve(targetDirectory);
    const directoryExists = fs.existsSync(absolute) && fs.statSync(absolute).isDirectory();
    const existingFiles: string[] = [];
    if (directoryExists) {
      for (const filename of ['AGENTS.md', 'agents.json']) {
        if (fs.existsSync(path.join(absolute, filename))) {
          existingFiles.push(filename);
        }
      }
    }
    return { directoryExists, existingFiles };
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
      { filename: 'AGENTS.md', content: renderAgentsMarkdown(team) },
      { filename: 'agents.json', content: `${JSON.stringify(team, null, 2)}\n` },
    ];
    const createdFiles: string[] = [];
    const overwrittenFiles: string[] = [];
    for (const file of files) {
      const fullPath = path.join(absolute, file.filename);
      const tempPath = `${fullPath}.tmp`;
      fs.writeFileSync(tempPath, file.content, 'utf-8');
      fs.renameSync(tempPath, fullPath);
      if (existing.includes(file.filename)) {
        overwrittenFiles.push(file.filename);
      } else {
        createdFiles.push(file.filename);
      }
    }
    this.log.info('Wrote team config to project directory', {
      targetDirectory: absolute,
      createdFiles,
      overwrittenFiles,
    });
    return {
      targetDirectory: absolute,
      createdFiles,
      overwrittenFiles,
    };
  }
}
