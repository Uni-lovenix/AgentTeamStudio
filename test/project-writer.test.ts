import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTeamConfig } from '../src/services/requirement-analyzer';
import {
  ProjectWriter,
  renderTeamMarkdown,
} from '../src/services/project-writer';

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
  it('writes AGENTS.team.md and agents.json without creating AGENTS.md', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);

    expect(result.createdFiles).toEqual(
      expect.arrayContaining(['AGENTS.team.md', 'agents.json'])
    );
    expect(result.createdFiles.filter((file) => file.startsWith('agents/'))).toHaveLength(
      team.agents.length
    );
    expect(result.overwrittenFiles).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'AGENTS.team.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'agents.json'))).toBe(true);
    const agentFiles = fs.readdirSync(path.join(dir, 'agents'));
    expect(agentFiles).toHaveLength(team.agents.length);
    expect(
      agentFiles.some((file) =>
        fs.readFileSync(path.join(dir, 'agents', file), 'utf-8').includes(team.agents[0].name)
      )
    ).toBe(true);
    expect(fs.existsSync(path.join(dir, 'AGENTS.md'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'CLAUDE.md'))).toBe(false);
    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual([]);
    expect(renderTeamMarkdown(team)).toContain('# Demo 智能体团队');
    expect(renderTeamMarkdown(team)).toContain('## 智能体文件');
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

    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual(['AGENTS.md']);
    expect(result.appendedFiles).toEqual(['AGENTS.md']);
    expect(content).toContain('# Existing Codex Rules');
    expect(content).toContain('使用智能体规则在 AGENTS.team.md 文件');

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

    expect(writer.inspectTarget(dir).existingRuleFiles).toEqual(['CLAUDE.md']);
    expect(result.appendedFiles).toEqual(['CLAUDE.md']);
    expect(content).toContain('# Existing Claude Rules');
    expect(content).toContain('使用智能体规则在 AGENTS.team.md 文件');
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

    writer.writeToDirectory(team, dir, true);
    const claudeContent = fs.readFileSync(claudePath, 'utf-8');
    const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
    expect(claudeContent.match(/使用智能体规则在 AGENTS\.team\.md 文件/g)).toHaveLength(1);
    expect(agentsContent.match(/使用智能体规则在 AGENTS\.team\.md 文件/g)).toHaveLength(1);
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
