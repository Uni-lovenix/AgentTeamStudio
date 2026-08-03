import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTeamConfig } from '../src/services/requirement-analyzer';
import {
  ProjectWriter,
  renderTeamMarkdown,
} from '../src/services/project-writer';
import { safeAgentFileName } from '../src/services/harness-templates';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-studio-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('project-writer', () => {
  it('writes team files and initializes the core RUP harness files', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);

    expect(result.createdFiles).toEqual(
      expect.arrayContaining([
        'AGENTS.team.md',
        'agents.json',
        'AGENTS.md',
        'CLAUDE.md',
        'feature_list.json',
        'progress.md',
        'session-handoff.md',
        'quality-document.md',
        'evaluator-rubric.md',
        'clean-state-checklist.md',
        'init.sh',
        'docs/PROCESS.md',
      ])
    );
    expect(result.createdFiles.filter((file) => file.startsWith('agents/'))).toHaveLength(
      team.agents.length
    );
    expect(result.overwrittenFiles).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'AGENTS.team.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'agents.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'CLAUDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'feature_list.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'progress.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'session-handoff.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'quality-document.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'evaluator-rubric.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'clean-state-checklist.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'init.sh'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'docs', 'PROCESS.md'))).toBe(true);
    const progress = fs.readFileSync(path.join(dir, 'progress.md'), 'utf-8');
    expect(progress).toContain('# Session Progress Log -- Demo');
    expect(progress).toContain('## Current State');
    const agentFiles = fs.readdirSync(path.join(dir, 'agents'));
    expect(agentFiles).toHaveLength(team.agents.length);
    expect(
      agentFiles.some((file) =>
        fs.readFileSync(path.join(dir, 'agents', file), 'utf-8').includes(team.agents[0].name)
      )
    ).toBe(true);
    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(renderTeamMarkdown(team)).toContain('# Demo 智能体团队');
    expect(renderTeamMarkdown(team)).toContain('## RUP 过程管理');
    expect(renderTeamMarkdown(team)).toContain('## 迭代协议');
    expect(renderTeamMarkdown(team)).toContain('评估者按迭代协议校验');
    expect(renderTeamMarkdown(team)).toContain('## 智能体路由');
    expect(renderTeamMarkdown(team)).not.toContain(`### ${team.agents[0].name}`);
    expect(
      fs
        .readFileSync(path.join(dir, 'agents', agentFiles[0]), 'utf-8')
        .includes('## 协作规则')
    ).toBe(true);

    const agentsRules = fs.readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8');
    const claudeRules = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8');
    expect(agentsRules).toContain('## 智能体地图');
    expect(agentsRules).toContain('不一次性加载所有角色文件');
    expect(agentsRules).not.toContain('## Startup Rules');
    expect(agentsRules).not.toContain('## RUP 过程管理');
    expect(agentsRules).not.toContain('## Definition of Done');
    expect(claudeRules).toContain('## 智能体地图');
    expect(claudeRules).toContain('不一次性加载所有角色文件');
    expect(claudeRules).not.toContain('## Operating Loop');
    expect(claudeRules).not.toContain('## RUP Process');
    expect(claudeRules).not.toContain('## Completion Gate');
    team.agents.forEach((agent, index) => {
      expect(agentsRules).toContain(`${agent.name}：\`agents/${safeAgentFileName(agent, index)}\``);
      expect(claudeRules).toContain(`${agent.name}：\`agents/${safeAgentFileName(agent, index)}\``);
    });

    const featureList = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf-8'));
    expect(featureList.features[0]).toMatchObject({
      id: 'harness-bootstrap',
      status: 'pass',
      rupPhase: 'inception',
    });
    expect(featureList.features.some((feature: { status: string }) => feature.status === 'not_started')).toBe(
      true
    );
    expect(
      fs.readFileSync(path.join(dir, 'docs', 'PROCESS.md'), 'utf-8')
    ).toContain('## 迭代协议');
    const qualityDocument = fs.readFileSync(path.join(dir, 'quality-document.md'), 'utf-8');
    expect(qualityDocument).toContain('# 质量文档 -- Demo');
    expect(qualityDocument).toContain('## Overall Grade: 待评估');
    expect(qualityDocument).toContain('## Evidence of Quality');
    expect(qualityDocument).toContain('## Verified Against');
    const evaluatorRubric = fs.readFileSync(path.join(dir, 'evaluator-rubric.md'), 'utf-8');
    expect(evaluatorRubric).toContain('# 评审评分表 -- Demo');
    expect(evaluatorRubric).toContain('| 分数 (1-5) |');
    expect(evaluatorRubric).toContain('**Overall: 待评估 / 5**');
    expect(evaluatorRubric).toContain('## Harness 文件评估');
    expect(evaluatorRubric).toContain('- [ ] Accept');
    expect(evaluatorRubric).toContain('- [ ] Revise');
    expect(evaluatorRubric).toContain('- [ ] Block');
    const cleanStateChecklist = fs.readFileSync(path.join(dir, 'clean-state-checklist.md'), 'utf-8');
    expect(cleanStateChecklist).toContain('# 干净状态检查清单 -- Demo');
    expect(cleanStateChecklist).toContain('## Build & Verification');
    expect(cleanStateChecklist).toContain('## Harness Integrity');
    expect(fs.statSync(path.join(dir, 'init.sh')).mode & 0o111).not.toBe(0);
  });

  it('refuses to overwrite unless explicitly allowed', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });
    writer.writeToDirectory(team, dir, false);

    expect(() => writer.writeToDirectory(team, dir, false)).toThrow(/需要覆盖/);
    const overwrite = writer.writeToDirectory(team, dir, true);
    expect(overwrite.overwrittenFiles).toEqual(
      expect.arrayContaining(['AGENTS.team.md', 'agents.json'])
    );
    expect(overwrite.overwrittenFiles.filter((file) => file.startsWith('agents/'))).toHaveLength(
      team.agents.length
    );
  });

  it('preserves existing harness state files when writing with overwrite enabled', () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, 'feature_list.json'), '{"features":[]}');
    fs.writeFileSync(path.join(dir, 'progress.md'), 'existing progress');
    fs.writeFileSync(path.join(dir, 'session-handoff.md'), 'existing handoff');
    fs.writeFileSync(path.join(dir, 'quality-document.md'), 'existing quality');
    fs.writeFileSync(path.join(dir, 'evaluator-rubric.md'), 'existing rubric');
    fs.writeFileSync(path.join(dir, 'clean-state-checklist.md'), 'existing checklist');
    fs.writeFileSync(path.join(dir, 'init.sh'), '#!/bin/bash\necho keep');
    fs.mkdirSync(path.join(dir, 'docs'));
    fs.writeFileSync(path.join(dir, 'docs', 'PROCESS.md'), 'existing process');
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, true);

    const preservedFiles = [
      'feature_list.json',
      'progress.md',
      'session-handoff.md',
      'quality-document.md',
      'evaluator-rubric.md',
      'clean-state-checklist.md',
      'init.sh',
      'docs/PROCESS.md',
    ];
    expect(result.createdFiles.filter((file) => preservedFiles.includes(file))).toEqual([]);
    expect(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf-8')).toBe('{"features":[]}');
    expect(fs.readFileSync(path.join(dir, 'progress.md'), 'utf-8')).toBe('existing progress');
    expect(fs.readFileSync(path.join(dir, 'session-handoff.md'), 'utf-8')).toBe('existing handoff');
    expect(fs.readFileSync(path.join(dir, 'quality-document.md'), 'utf-8')).toBe('existing quality');
    expect(fs.readFileSync(path.join(dir, 'evaluator-rubric.md'), 'utf-8')).toBe('existing rubric');
    expect(fs.readFileSync(path.join(dir, 'clean-state-checklist.md'), 'utf-8')).toBe('existing checklist');
    expect(fs.readFileSync(path.join(dir, 'init.sh'), 'utf-8')).toBe('#!/bin/bash\necho keep');
    expect(fs.readFileSync(path.join(dir, 'docs', 'PROCESS.md'), 'utf-8')).toBe(
      'existing process'
    );
  });

  it('appends a pointer to existing AGENTS.md without replacing its rules', () => {
    const dir = makeTempDir();
    const agentsPath = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(agentsPath, '# Existing Codex Rules\n\nDo not remove.\n');
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);
    const content = fs.readFileSync(agentsPath, 'utf-8');

    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(result.appendedFiles).toEqual(['AGENTS.md']);
    expect(content).toContain('# Existing Codex Rules');
    expect(content).toContain('使用智能体规则在 AGENTS.team.md 文件');
    expect(content).not.toContain('协作流程：规划者每个迭代开始前制定迭代协议');

    writer.writeToDirectory(team, dir, true);
    const secondContent = fs.readFileSync(agentsPath, 'utf-8');
    expect(secondContent.match(/使用智能体规则在 AGENTS\.team\.md 文件/g)).toHaveLength(1);
  });

  it('appends a pointer to existing CLAUDE.md without replacing its rules', () => {
    const dir = makeTempDir();
    const claudePath = path.join(dir, 'CLAUDE.md');
    fs.writeFileSync(claudePath, '# Existing Claude Rules\n\nKeep this file.\n');
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);
    const content = fs.readFileSync(claudePath, 'utf-8');

    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(result.appendedFiles).toEqual(['CLAUDE.md']);
    expect(content).toContain('# Existing Claude Rules');
    expect(content).toContain('使用智能体规则在 AGENTS.team.md 文件');
    expect(content).not.toContain('协作流程：规划者每个迭代开始前制定迭代协议');
  });

  it('appends pointers to both CLAUDE.md and AGENTS.md when both exist', () => {
    const dir = makeTempDir();
    const claudePath = path.join(dir, 'CLAUDE.md');
    const agentsPath = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(claudePath, '# Claude Rules\n');
    fs.writeFileSync(agentsPath, '# Codex Rules\n');
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);

    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(result.appendedFiles).toEqual(['CLAUDE.md', 'AGENTS.md']);
    expect(fs.readFileSync(claudePath, 'utf-8')).toContain('使用智能体规则在 AGENTS.team.md 文件');
    expect(fs.readFileSync(agentsPath, 'utf-8')).toContain('使用智能体规则在 AGENTS.team.md 文件');
    expect(fs.readFileSync(claudePath, 'utf-8')).not.toContain('协作流程：');
    expect(fs.readFileSync(agentsPath, 'utf-8')).not.toContain('协作流程：');

    writer.writeToDirectory(team, dir, true);
    const claudeContent = fs.readFileSync(claudePath, 'utf-8');
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
    expect(claudeContent.match(/使用智能体规则在 AGENTS\.team\.md 文件/g)).toHaveLength(1);
    expect(agentsContent.match(/使用智能体规则在 AGENTS\.team\.md 文件/g)).toHaveLength(1);
  });

  it('preserves legacy content while appending only the team rules pointer', () => {
    const dir = makeTempDir();
    const agentsPath = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(
      agentsPath,
      '# Existing Codex Rules\n\n协作流程：规划者每项任务开始前制定冲刺协议，开发者按协议开发，评估者按协议校验并反馈给开发者修改。\n'
    );
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);
    const content = fs.readFileSync(agentsPath, 'utf-8');

    expect(result.appendedFiles).toEqual(['AGENTS.md']);
    expect(content).toContain('# Existing Codex Rules');
    expect(content).toContain('冲刺协议');
    expect(content).not.toContain('协作流程：规划者每个迭代开始前制定迭代协议');
    expect(content).toContain('使用智能体规则在 AGENTS.team.md 文件');

    const secondResult = writer.writeToDirectory(team, dir, true);
    const secondContent = fs.readFileSync(agentsPath, 'utf-8');
    expect(secondResult.appendedFiles).toEqual([]);
    expect(secondContent.match(/使用智能体规则在 AGENTS\.team\.md 文件/g)).toHaveLength(1);
  });

  it('derives the transition feature from process management instead of hardcoded iteration ids', () => {
    const dir = makeTempDir();
    const base = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });
    const originalTransition = base.processManagement.iterations.find(
      (iteration) => iteration.phaseId === 'transition'
    );
    if (!originalTransition) throw new Error('fixture missing transition iteration');
    const transitionIterationId = 'transition-final-acceptance';
    const team = {
      ...base,
      processManagement: {
        ...base.processManagement,
        iterations: base.processManagement.iterations.map((iteration) =>
          iteration.id === originalTransition.id
            ? { ...iteration, id: transitionIterationId }
            : iteration
        ),
      },
    };

    const result = new ProjectWriter().writeToDirectory(team, dir, false);
    const featureList = JSON.parse(
      fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf-8')
    );
    const transitionFeature = featureList.features.find(
      (feature: { rupPhase?: string }) => feature.rupPhase === 'transition'
    );
    const customTransition = team.processManagement.iterations.find(
      (iteration) => iteration.id === transitionIterationId
    );
    const customOwnerRole = customTransition
      ? team.agents.find((agent) => agent.id === customTransition.ownerRoleId)?.name ?? ''
      : '';

    expect(result.createdFiles).toContain('feature_list.json');
    expect(transitionFeature.iteration).toBe(transitionIterationId);
    expect(transitionFeature.ownerRole).toBe(customOwnerRole);
  });

  it('rejects a missing target directory', () => {
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });
    expect(() => writer.writeToDirectory(team, path.join(os.tmpdir(), 'missing-agent-team-dir'), false)).toThrow(
      /不存在/
    );
  });
});
