// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/renderer/App';
import { buildTeamConfig } from '../src/services/requirement-analyzer';

const REQUIREMENT =
  '一个企业知识库应用，需要文档管理、权限控制、全文检索、审核流程和发布通知。';

function makeTeam() {
  return buildTeamConfig({
    projectName: '企业知识库',
    requirement: REQUIREMENT,
    techStackHints: 'React, TypeScript, Electron',
  });
}

function makeDraft(overrides: Partial<import('../src/shared/types').ProjectDraft> = {}) {
  const now = new Date().toISOString();
  return {
    id: 'draft-smoke',
    projectName: '企业知识库',
    requirement: REQUIREMENT,
    techStackHints: 'React, TypeScript, Electron',
    team: null,
    targetPath: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function installBridge(overrides: Partial<Window['agentTeamStudio']> = {}) {
  const localProjects: import('../src/shared/types').ProjectDraft[] = [];
  const writeResult = {
    targetDirectory: '/tmp/agent-team-smoke',
    createdFiles: [
      'AGENTS.team.md',
      'agents.json',
      'agents/01-规划者.md',
      'agents/02-评估者.md',
      'agents/03-账户与权限开发者.md',
      'agents/04-搜索与推荐开发者.md',
      'agents/05-内容与审核开发者.md',
      'agents/06-文档与交接负责人.md',
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
    ],
    overwrittenFiles: [],
    appendedFiles: [],
  };
  const bridge = {
    projects: {
      list: vi.fn().mockImplementation(async () => [...localProjects]),
      create: vi.fn().mockImplementation(async (projectName = '未命名项目') => {
        const draft = makeDraft({
          id: `draft-${Date.now()}`,
          projectName,
        });
        localProjects.push(draft);
        return draft;
      }),
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (draft) => {
        const index = localProjects.findIndex((item) => item.id === draft.id);
        if (index >= 0) {
          localProjects[index] = draft;
        } else {
          localProjects.push(draft);
        }
        return draft;
      }),
      delete: vi.fn().mockResolvedValue(true),
    },
    team: {
      generate: vi.fn().mockResolvedValue({
        team: makeTeam(),
        warnings: [],
        llmAttempted: false,
      }),
      inspect: vi.fn().mockResolvedValue({
        directoryExists: true,
        existingFiles: ['AGENTS.team.md', 'agents.json'],
        existingRuleFiles: [],
      }),
      validate: vi.fn().mockImplementation(async (team) => ({
        team,
        validation: {
          ok: true,
          errors: [],
          warnings: [],
          repairs: [],
        },
      })),
      write: vi.fn().mockResolvedValue(writeResult),
    },
    dialog: {
      selectDirectory: vi.fn().mockResolvedValue('/tmp/agent-team-smoke'),
    },
    settings: {
      get: vi.fn().mockResolvedValue({
        llm: {
          enabled: false,
          baseUrl: '',
          model: '',
          protocol: 'openai',
        },
        hasApiKey: false,
      }),
      save: vi.fn().mockImplementation(async (input) => ({
        llm: input.llm,
        hasApiKey: Boolean(input.apiKey) || Boolean(input.clearApiKey),
      })),
      test: vi.fn().mockResolvedValue({
        ok: true,
        message: 'ok',
        latencyMs: 1,
      }),
    },
    app: {
      reset: vi.fn().mockResolvedValue({ success: true }),
      status: vi.fn().mockImplementation(async () => ({
        projectCount: localProjects.length,
        llmEnabled: false,
        hasApiKey: false,
        lastActivity: '',
      })),
    },
    ...overrides,
  };
  window.agentTeamStudio = bridge;
  return bridge;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('renderer critical workflow smoke', () => {
  it('creates a new project draft from the sidebar', async () => {
    const bridge = installBridge();
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText('暂无项目草稿');
    await user.click(screen.getByRole('button', { name: '新建项目' }));

    await screen.findByText('未命名项目');
    expect(bridge.projects.create).toHaveBeenCalledWith('未命名项目');
    expect(screen.queryByText('暂无项目草稿')).toBeNull();
  });

  it('generates a team and supports editing roles and adding custom roles', async () => {
    const bridge = installBridge();
    const user = userEvent.setup();

    render(<App />);

    await screen.findByText('暂无项目草稿');
    await user.click(screen.getByRole('button', { name: '新建项目' }));
    await screen.findByText('未命名项目');

    const nameInput = screen.getByLabelText('项目名称');
    const requirementInput = screen.getByLabelText('需求描述');
    await user.clear(nameInput);
    await user.type(nameInput, '企业知识库');
    await user.clear(requirementInput);
    await user.type(requirementInput, REQUIREMENT);
    await user.click(screen.getByRole('button', { name: '生成团队' }));

    await screen.findByRole('heading', { name: '企业知识库' });
    expect(bridge.team.generate).toHaveBeenCalledWith({
      projectName: '企业知识库',
      requirement: REQUIREMENT,
      techStackHints: 'React, TypeScript, Electron',
      useLlm: false,
    });
    expect(screen.getAllByLabelText('角色名称').length).toBeGreaterThanOrEqual(6);

    const firstRoleName = screen.getAllByLabelText('角色名称')[0];
    await user.clear(firstRoleName);
    await user.type(firstRoleName, '规划负责人');
    await waitFor(() => {
      expect((screen.getAllByLabelText('角色名称')[0] as HTMLInputElement).value).toBe(
        '规划负责人'
      );
    });

    await user.click(screen.getByRole('button', { name: '添加角色' }));
    expect(screen.getByDisplayValue('新角色')).toBeTruthy();
  });

  it('selects a target directory, validates, and writes the team and harness', async () => {
    const bridge = installBridge();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    await screen.findByText('暂无项目草稿');
    await user.click(screen.getByRole('button', { name: '新建项目' }));
    await screen.findByText('未命名项目');

    const nameInput = screen.getByLabelText('项目名称');
    const requirementInput = screen.getByLabelText('需求描述');
    await user.clear(nameInput);
    await user.type(nameInput, '企业知识库');
    await user.clear(requirementInput);
    await user.type(requirementInput, REQUIREMENT);
    await user.click(screen.getByRole('button', { name: '生成团队' }));
    await screen.findByRole('heading', { name: '企业知识库' });

    await user.click(screen.getByRole('button', { name: '选择项目目录' }));
    await screen.findByText('/tmp/agent-team-smoke');

    await user.click(screen.getByRole('button', { name: '写入项目目录' }));
    await screen.findByText(/已写入 18 个文件/);

    expect(bridge.team.validate).toHaveBeenCalled();
    expect(bridge.team.inspect).toHaveBeenCalledWith('/tmp/agent-team-smoke');
    expect(window.confirm).toHaveBeenCalledWith(
      '目标目录已有 AGENTS.team.md、agents.json，是否覆盖？'
    );
    expect(bridge.team.write).toHaveBeenCalledWith({
      team: expect.objectContaining({
        projectName: '企业知识库',
        schemaVersion: 3,
      }),
      targetDirectory: '/tmp/agent-team-smoke',
      overwrite: true,
    });
    expect(bridge.projects.save).toHaveBeenCalledWith(
      expect.objectContaining({
        targetPath: '/tmp/agent-team-smoke',
        team: expect.objectContaining({ projectName: '企业知识库' }),
      })
    );
  });
});
