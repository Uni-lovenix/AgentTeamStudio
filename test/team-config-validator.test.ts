import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectWriter } from '../src/services/project-writer';
import { buildTeamConfig } from '../src/services/requirement-analyzer';
import {
  repairTeamConfig,
  validateGeneratedHarness,
  validateTeamConfig,
} from '../src/services/team-config-validator';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-validator-'));
  tempDirs.push(dir);
  return dir;
}

function baseTeam() {
  return buildTeamConfig({
    projectName: 'Validator Demo',
    requirement: '一个跨平台桌面应用，用于生成多智能体团队配置。',
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('team-config-validator', () => {
  it('accepts generated teams with schema v3 role kinds', () => {
    const team = baseTeam();
    const validation = validateTeamConfig(team);

    expect(team.schemaVersion).toBe(3);
    expect(validation.errors).toEqual([]);
    expect(team.agents.some((agent) => agent.kind === 'planner')).toBe(true);
    expect(team.agents.some((agent) => agent.kind === 'evaluator')).toBe(true);
    expect(team.agents.some((agent) => agent.kind === 'developer')).toBe(true);
  });

  it('keeps semantic role identity after renaming a required role', () => {
    const base = baseTeam();
    const team = {
      ...base,
      agents: base.agents.map((agent) =>
        agent.kind === 'planner' ? { ...agent, name: '计划负责人' } : agent
      ),
    };

    const validation = validateTeamConfig(team);

    expect(validation.errors).toEqual([]);
    expect(team.agents.find((agent) => agent.name === '计划负责人')?.kind).toBe('planner');
  });

  it('repairs missing required roles and dangling role references by kind', () => {
    const base = baseTeam();
    const team = {
      ...base,
      agents: base.agents.filter((agent) => agent.kind !== 'planner'),
      workflow: base.workflow.map((step) => ({ ...step, ownerRoleId: 'missing-role' })),
    };

    const repaired = repairTeamConfig(team);
    const validation = validateTeamConfig(repaired);

    expect(repaired.agents.some((agent) => agent.kind === 'planner')).toBe(true);
    expect(
      repaired.workflow.every((step) =>
        repaired.agents.some((agent) => agent.id === step.ownerRoleId)
      )
    ).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(repaired.agents.filter((agent) => agent.kind === 'planner')).toHaveLength(1);
  });

  it('demotes duplicate planner roles to custom roles', () => {
    const team = baseTeam();
    const planner = team.agents.find((agent) => agent.kind === 'planner');
    if (!planner) throw new Error('fixture missing planner');
    const broken = {
      ...team,
      agents: [
        ...team.agents,
        {
          ...planner,
          id: 'planner-2',
          name: '第二规划者',
        },
      ],
    };

    const repaired = repairTeamConfig(broken);
    const duplicate = repaired.agents.find((agent) => agent.name === '第二规划者');

    expect(repaired.agents.filter((agent) => agent.kind === 'planner')).toHaveLength(1);
    expect(duplicate?.kind).toBe('custom');
    expect(validateTeamConfig(repaired).ok).toBe(true);
  });

  it('blocks unfixable empty required role fields', () => {
    const base = baseTeam();
    const team = {
      ...base,
      agents: base.agents.map((agent, index) =>
        index === 0 ? { ...agent, mission: '   ' } : agent
      ),
    };

    const validation = validateTeamConfig(team);
    const repairedValidation = validateTeamConfig(repairTeamConfig(team));

    expect(validation.ok).toBe(false);
    expect(repairedValidation.ok).toBe(false);
    expect(repairedValidation.errors.some((item) => item.path.endsWith('.mission'))).toBe(true);
  });

  it('validates the generated harness after export', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = baseTeam();

    const result = writer.writeToDirectory(team, dir, false);
    const validation = validateGeneratedHarness(dir, team, result.createdFiles);

    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('rejects a generated clean-state-checklist without the expected marker', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = baseTeam();

    const result = writer.writeToDirectory(team, dir, false);
    fs.writeFileSync(path.join(dir, 'clean-state-checklist.md'), '# broken\n', 'utf-8');
    const validation = validateGeneratedHarness(dir, team, [
      ...result.createdFiles,
      'clean-state-checklist.md',
    ]);

    expect(validation.ok).toBe(false);
    expect(
      validation.errors.some((item) => item.path === 'clean-state-checklist.md')
    ).toBe(true);
  });

  it('rejects a generated progress.md without the expected marker', () => {
    const dir = makeTempDir();
    const writer = new ProjectWriter();
    const team = baseTeam();

    const result = writer.writeToDirectory(team, dir, false);
    fs.writeFileSync(path.join(dir, 'progress.md'), '# broken\n', 'utf-8');
    const validation = validateGeneratedHarness(dir, team, [
      ...result.createdFiles,
      'progress.md',
    ]);

    expect(validation.ok).toBe(false);
    expect(validation.errors.some((item) => item.path === 'progress.md')).toBe(true);
  });
});
