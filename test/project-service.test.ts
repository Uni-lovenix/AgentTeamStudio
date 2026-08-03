import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PersistenceService } from '../src/services/persistence-service';
import { ProjectService } from '../src/services/project-service';
import { buildTeamConfig } from '../src/services/requirement-analyzer';
import { ProjectDraft, TeamConfig } from '../src/shared/types';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-project-service-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('project-service', () => {
  it('migrates persisted v1 drafts to schema v2 with RUP process management', () => {
    const dataDir = path.join(makeTempDir(), 'data');
    const persistence = new PersistenceService(dataDir);
    const modern = buildTeamConfig({
      projectName: 'Legacy',
      requirement: '一个命令行工具，用于管理任务。',
    });
    const legacyTeam = {
      ...modern,
      schemaVersion: 1,
      processManagement: undefined,
      workflow: [
        {
          id: 'sprint-protocol',
          name: '制定冲刺协议',
          description: '规划者在每项任务开始前制定冲刺协议。',
          ownerRoleId: modern.agents[0].id,
        },
      ],
    } as unknown as TeamConfig;
    const legacyDraft = {
      id: 'legacy-1',
      projectName: 'Legacy',
      requirement: '一个命令行工具，用于管理任务。',
      techStackHints: '',
      team: legacyTeam,
      targetPath: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    } as unknown as ProjectDraft;
    persistence.writeJson('projects.json', [legacyDraft]);

    const service = new ProjectService(persistence);
    const projects = service.list();

    expect(projects[0].team?.schemaVersion).toBe(2);
    expect(projects[0].team?.processManagement.framework).toBe('rup');
    expect(projects[0].team?.processManagement.phases).toHaveLength(4);
    expect(projects[0].team?.workflow[0].name).toBe('制定迭代协议');
    expect(projects[0].team?.workflow[0].description).toContain('迭代');
    expect(projects[0].team?.workflow.some((step) => step.name.includes('冲刺'))).toBe(false);

    const stored = persistence.readJson<ProjectDraft[]>('projects.json') ?? [];
    expect(stored[0].team?.schemaVersion).toBe(2);
    expect(stored[0].team?.processManagement).toBeDefined();
  });
});
