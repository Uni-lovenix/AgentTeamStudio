import { v4 as uuidv4 } from 'uuid';
import {
  AgentRole,
  EngineeringConventions,
  TeamConfig,
  WorkflowStep,
} from '../shared/types';

export interface RequirementAnalysisContext {
  projectName?: string;
  requirement: string;
  techStackHints?: string;
}

function createRole(
  name: string,
  mission: string,
  responsibilities: string[],
  skills: string[],
  tools: string[],
  deliverables: string[],
  dependsOn: string[] = [],
  notifies: string[] = []
): AgentRole {
  return {
    id: uuidv4(),
    name,
    mission,
    responsibilities,
    skills,
    tools,
    deliverables,
    dependsOn,
    notifies,
  };
}

const DEFAULT_CONVENTIONS: EngineeringConventions = {
  branch: '每个功能使用独立分支，分支名格式为 feature/<功能名>。',
  commits: '提交信息使用简洁中文或英文，说明变更意图并关联对应需求。',
  pullRequests: '每个分支提交 PR，描述变更、测试结果和影响范围，由非作者角色评审。',
  testing: '实现完成后必须运行类型检查、单元测试和相关手工验证。',
  documentation: '架构决策、接口变更和运行方式必须同步更新到项目文档。',
};

export function parseTechStackHints(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectStack(requirement: string): {
  web: boolean;
  backend: boolean;
  mobile: boolean;
  desktop: boolean;
  ai: boolean;
  data: boolean;
  cli: boolean;
} {
  const text = requirement.toLowerCase();
  return {
    web: /web|前端|frontend|react|vue|browser|website|saas|网站|管理后台|h5|ui/i.test(text),
    backend: /后端|backend|api|server|服务端|数据库|微服务|microservice|auth|middleware/i.test(text),
    mobile: /移动端|mobile|ios|android|app端|h5 app/i.test(text),
    desktop: /桌面|desktop|electron|windows|mac|客户端|client/i.test(text),
    ai: /ai|llm|大模型|智能体|agent|模型|推理|prompt|rag/i.test(text),
    data: /数据|data|etl|报表|分析|analytics|pipeline/i.test(text),
    cli: /命令行|cli|终端|terminal|脚本工具/i.test(text),
  };
}

export function buildTeamConfig(context: RequirementAnalysisContext): TeamConfig {
  const requirement = context.requirement.trim();
  const projectName = context.projectName?.trim() || '未命名项目';
  const techStackHints = parseTechStackHints(context.techStackHints);
  const stack = detectStack(requirement);

  const roles: AgentRole[] = [];
  const roleIndex = new Map<string, AgentRole>();

  const addRole = (role: AgentRole): void => {
    roleIndex.set(role.name, role);
    roles.push(role);
  };

  addRole(
    createRole(
      '产品负责人',
      '把模糊需求整理成可执行的范围、验收标准和优先级。',
      ['澄清需求目标与边界', '拆解用户故事和验收标准', '确认非功能需求与风险'],
      ['需求拆解', '范围管理', '沟通协调'],
      ['需求文档', '任务看板'],
      ['需求说明', '验收清单'],
      [],
      ['架构师', '开发角色']
    )
  );

  addRole(
    createRole(
      '架构师',
      '设计系统边界、模块结构、技术选型和协作契约。',
      ['确定技术栈与模块边界', '设计数据流和关键接口', '定义评审与演进规则'],
      ['系统设计', '架构评审', '技术选型'],
      ['架构图', '接口设计工具'],
      ['架构说明', '接口契约'],
      ['产品负责人'],
      ['开发角色', 'QA', '文档工程师']
    )
  );

  const needsBackend = stack.backend || stack.web || stack.data || stack.ai;
  if (needsBackend) {
    addRole(
      createRole(
        '后端工程师',
        '实现服务端能力、数据存储、API 契约和业务逻辑。',
        ['实现业务 API', '设计数据模型与持久化', '保障错误处理和安全'],
        ['后端开发', '数据库设计', 'API 设计'],
        ['编辑器', '数据库工具', 'API 调试工具'],
        ['可运行服务', 'API 文档', '测试用例'],
        ['架构师'],
        ['前端工程师', 'QA']
      )
    );
  }

  const needsFrontend = stack.web || stack.mobile || stack.desktop || stack.cli;
  if (needsFrontend) {
    addRole(
      createRole(
        stack.mobile || stack.desktop ? '客户端工程师' : '前端工程师',
        '实现用户界面、交互状态和端到端可用性。',
        ['实现界面与交互', '接入业务 API', '处理加载、错误和空状态'],
        ['前端开发', '响应式设计', '可访问性'],
        ['编辑器', '浏览器调试工具'],
        ['可用界面', '组件文档'],
        needsBackend ? ['后端工程师'] : ['架构师'],
        ['QA']
      )
    );
  }

  if (stack.ai || stack.data) {
    addRole(
      createRole(
        '数据/AI 工程师',
        '设计数据处理链路、模型接入和可观测性。',
        ['设计数据采集与清洗流程', '接入模型或推理服务', '定义评估指标与日志'],
        ['数据处理', 'LLM 应用', '评测'],
        ['数据工具', 'Prompt 调试工具'],
        ['数据处理方案', '评估报告'],
        needsBackend ? ['后端工程师'] : ['架构师'],
        ['QA', '文档工程师']
      )
    );
  }

  addRole(
    createRole(
      'QA 工程师',
      '验证功能行为、回归风险和验收标准是否被满足。',
      ['编写测试计划', '执行手工和自动化测试', '跟踪缺陷并验证修复'],
      ['测试设计', '自动化测试', '缺陷管理'],
      ['测试框架', '缺陷跟踪工具'],
      ['测试报告', '缺陷清单'],
      roles.filter((role) => role.name !== 'QA 工程师').map((role) => role.name),
      ['产品负责人']
    )
  );

  addRole(
    createRole(
      '文档工程师',
      '把需求、架构和交付信息沉淀为团队可读的文档。',
      ['维护项目说明', '整理接口和运行文档', '记录关键决策'],
      ['技术写作', '文档结构设计'],
      ['Markdown', '知识库工具'],
      ['项目文档', '交付说明'],
      roles.filter((role) => role.name !== '文档工程师').map((role) => role.name),
      ['产品负责人']
    )
  );

  const workflow: WorkflowStep[] = [
    {
      id: 'clarify',
      name: '需求澄清',
      description: '确认目标、边界、优先级和验收标准。',
      ownerRoleId: roleIndex.get('产品负责人')?.id ?? roles[0].id,
    },
    {
      id: 'architecture',
      name: '架构设计',
      description: '确定模块、接口、数据流和技术约束。',
      ownerRoleId: roleIndex.get('架构师')?.id ?? roles[0].id,
    },
    {
      id: 'implementation',
      name: '协作实现',
      description: '按角色分工实现功能并保持接口一致。',
      ownerRoleId: roleIndex.get('后端工程师')?.id ?? roleIndex.get('前端工程师')?.id ?? roles[0].id,
    },
    {
      id: 'review',
      name: '评审与测试',
      description: '交叉评审代码、补充测试并处理缺陷。',
      ownerRoleId: roleIndex.get('QA 工程师')?.id ?? roles[0].id,
    },
    {
      id: 'documentation',
      name: '文档收尾',
      description: '更新运行说明、接口文档和交付清单。',
      ownerRoleId: roleIndex.get('文档工程师')?.id ?? roles[0].id,
    },
  ];

  return {
    schemaVersion: 1,
    projectName,
    requirement,
    techStackHints,
    generatedBy: 'local',
    createdAt: new Date().toISOString(),
    workflow,
    agents: roles,
    conventions: DEFAULT_CONVENTIONS,
  };
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRole(raw: unknown, index: number): AgentRole {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `role-${index + 1}`,
    name: typeof value.name === 'string' && value.name ? value.name : `角色 ${index + 1}`,
    mission: typeof value.mission === 'string' ? value.mission : '负责对应的项目职责。',
    responsibilities: asStringArray(value.responsibilities, []),
    skills: asStringArray(value.skills, []),
    tools: asStringArray(value.tools, []),
    deliverables: asStringArray(value.deliverables, []),
    dependsOn: asStringArray(value.dependsOn, []),
    notifies: asStringArray(value.notifies, []),
  };
}

export function normalizeTeamConfig(
  raw: unknown,
  context: RequirementAnalysisContext
): TeamConfig {
  const value = (raw ?? {}) as Record<string, unknown>;
  const fallback = buildTeamConfig(context);
  const agents = Array.isArray(value.agents)
    ? value.agents.map(normalizeRole).slice(0, 12)
    : fallback.agents;
  const usedIds = new Set<string>();
  const dedupedAgents = agents.map((agent, index) => {
    let id = agent.id;
    while (usedIds.has(id)) {
      id = `${agent.id}-${index + 1}`;
    }
    usedIds.add(id);
    return { ...agent, id };
  });
  const rawWorkflow = Array.isArray(value.workflow) ? value.workflow : fallback.workflow;
  const workflow: WorkflowStep[] = rawWorkflow
    .map((step, index) => {
      const item = (step ?? {}) as Record<string, unknown>;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `step-${index + 1}`,
        name: typeof item.name === 'string' && item.name ? item.name : `步骤 ${index + 1}`,
        description: typeof item.description === 'string' ? item.description : '',
        ownerRoleId: typeof item.ownerRoleId === 'string' ? item.ownerRoleId : dedupedAgents[0]?.id ?? '',
      };
    })
    .slice(0, 10);
  const rawConventions = (value.conventions ?? {}) as Record<string, unknown>;

  return {
    schemaVersion: 1,
    projectName:
      typeof value.projectName === 'string' && value.projectName
        ? value.projectName
        : context.projectName?.trim() || '未命名项目',
    requirement: context.requirement.trim(),
    techStackHints: parseTechStackHints(context.techStackHints),
    generatedBy: 'llm',
    createdAt: new Date().toISOString(),
    workflow,
    agents: dedupedAgents,
    conventions: {
      branch:
        typeof rawConventions.branch === 'string' && rawConventions.branch
          ? rawConventions.branch
          : fallback.conventions.branch,
      commits:
        typeof rawConventions.commits === 'string' && rawConventions.commits
          ? rawConventions.commits
          : fallback.conventions.commits,
      pullRequests:
        typeof rawConventions.pullRequests === 'string' && rawConventions.pullRequests
          ? rawConventions.pullRequests
          : fallback.conventions.pullRequests,
      testing:
        typeof rawConventions.testing === 'string' && rawConventions.testing
          ? rawConventions.testing
          : fallback.conventions.testing,
      documentation:
        typeof rawConventions.documentation === 'string' && rawConventions.documentation
          ? rawConventions.documentation
          : fallback.conventions.documentation,
    },
  };
}
