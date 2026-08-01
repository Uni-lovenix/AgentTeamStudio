import { describe, expect, it } from 'vitest';
import {
  buildTeamConfig,
  normalizeTeamConfig,
} from '../src/services/requirement-analyzer';

describe('requirement-analyzer', () => {
  it('creates a relevant team for a web application with a backend', () => {
    const team = buildTeamConfig({
      projectName: 'Shop',
      requirement: '一个 React web 应用，需要后端 API 管理用户和订单，并且要有测试和文档。',
      techStackHints: 'React, TypeScript, Node.js',
    });

    const names = team.agents.map((agent) => agent.name);
    expect(names).toContain('前端工程师');
    expect(names).toContain('后端工程师');
    expect(names).toContain('QA 工程师');
    expect(names).toContain('文档工程师');
    expect(team.projectName).toBe('Shop');
    expect(team.techStackHints).toContain('React');
    expect(team.workflow.length).toBeGreaterThanOrEqual(4);
  });

  it('adds AI and data engineers for AI requirements', () => {
    const team = buildTeamConfig({
      requirement: '构建一个基于大模型的智能体协作平台，需要处理用户数据并生成任务计划。',
    });

    expect(team.projectName).toBe('未命名项目');
    expect(team.agents.some((agent) => agent.name.includes('数据'))).toBe(true);
    expect(team.agents.some((agent) => agent.name.includes('AI'))).toBe(true);
  });

  it('normalizes an LLM payload with safe fallbacks', () => {
    const team = normalizeTeamConfig(
      {
        projectName: 'LLM Project',
        agents: [
          {
            id: 'a1',
            name: '开发者',
            mission: '实现功能',
            responsibilities: ['写代码'],
            skills: ['TypeScript'],
            tools: [],
            deliverables: [],
            dependsOn: [],
            notifies: [],
          },
        ],
        workflow: [],
        conventions: {},
      },
      {
        projectName: 'LLM Project',
        requirement: '一个命令行工具，支持任务管理。',
      }
    );

    expect(team.generatedBy).toBe('llm');
    expect(team.agents[0].name).toBe('开发者');
    expect(team.agents[0].responsibilities).toEqual(['写代码']);
    expect(team.conventions.branch).toBeTruthy();
  });
});
