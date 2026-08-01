import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTeamConfig } from '../src/services/requirement-analyzer';
import {
  ProjectWriter,
  renderAgentsMarkdown,
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
  it('writes AGENTS.md and agents.json atomically', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = buildTeamConfig({
      projectName: 'Demo',
      requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
    });

    const result = writer.writeToDirectory(team, dir, false);

    expect(result.createdFiles).toEqual(['AGENTS.md', 'agents.json']);
    expect(result.overwrittenFiles).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'AGENTS.md'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'agents.json'))).toBe(true);
    expect(renderAgentsMarkdown(team)).toContain('# Demo 智能体团队');
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
    expect(overwrite.overwrittenFiles).toEqual(['AGENTS.md', 'agents.json']);
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
