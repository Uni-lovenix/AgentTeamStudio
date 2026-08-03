import {
  AgentRole,
  IterationStatus,
  ProcessManagement,
  ProcessPhaseId,
  RupIteration,
  RupPhase,
  TeamConfig,
  WorkflowStep,
} from '../shared/types';

const PHASE_IDS: ProcessPhaseId[] = [
  'inception',
  'elaboration',
  'construction',
  'transition',
];

const ITERATION_STATUSES: IterationStatus[] = [
  'planned',
  'active',
  'completed',
  'blocked',
];

const RUP_RULES = [
  '每个阶段必须有明确的里程碑与退出标准，未达退出标准不得进入下一阶段。',
  '每个迭代开始前由规划者制定迭代协议，明确目标、范围、计划、交付物和退出标准。',
  '开发者按迭代协议交付，评估者按退出标准校验并反馈给对应开发者。',
  '风险、反馈和未满足项必须记录到下一迭代或已知问题清单。',
  '不引入独立的 RUP 角色；规划者、评估者、开发者和文档交接负责人按各自职责承担过程管理。',
];

function roleById(agents: AgentRole[], id?: string): AgentRole | undefined {
  return agents.find((agent) => agent.id === id);
}

function roleByName(agents: AgentRole[], name: string): AgentRole | undefined {
  return agents.find((agent) => agent.name === name);
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function phaseId(value: unknown, fallback: ProcessPhaseId): ProcessPhaseId {
  return typeof value === 'string' && PHASE_IDS.includes(value as ProcessPhaseId)
    ? (value as ProcessPhaseId)
    : fallback;
}

function iterationStatus(value: unknown, fallback: IterationStatus): IterationStatus {
  return typeof value === 'string' &&
    ITERATION_STATUSES.includes(value as IterationStatus)
    ? (value as IterationStatus)
    : fallback;
}

function iterationNameForDeveloper(role: AgentRole, index: number): string {
  const label = role.name.replace(/开发者$/, '').trim();
  return label ? `${label}开发迭代` : `核心功能开发迭代 ${index + 1}`;
}

export function buildProcessManagement(
  agents: AgentRole[],
  requirement: string,
  techStackHints: string[] = []
): ProcessManagement {
  const planner =
    roleByName(agents, '规划者') ?? roleByName(agents, 'Planner') ?? agents[0];
  const evaluator =
    roleByName(agents, '评估者') ?? roleByName(agents, 'Evaluator') ?? agents[0];
  const docsRole =
    roleByName(agents, '文档与交接负责人') ?? agents[0];
  const developerRoles = agents.filter((agent) => agent.name.includes('开发者'));
  const primaryDeveloper = developerRoles[0] ?? agents[0];

  const iterations: RupIteration[] = [
    {
      id: 'inception-1',
      phaseId: 'inception',
      name: '启动范围确认',
      objective: '确认项目边界、核心目标、约束和初始风险。',
      scope: [
        '项目目标',
        '核心用户与关键场景',
        '范围边界',
        '主要约束',
        ...(techStackHints.length > 0 ? [`技术栈：${techStackHints.join('、')}`] : []),
      ],
      plan: ['整理需求与目标', '识别关键用户和场景', '列出初始风险', '制定首个迭代计划'],
      exitCriteria: ['范围、目标和约束已确认', '初始风险已列出', '启动阶段可交付物已形成'],
      deliverables: ['项目范围说明', '初始风险清单', '初始迭代计划'],
      ownerRoleId: planner.id,
      feedbackTargetRoleId: evaluator.id,
      status: 'planned',
    },
    {
      id: 'elaboration-1',
      phaseId: 'elaboration',
      name: '架构与风险细化',
      objective: '降低关键技术风险，形成可执行的架构基线和迭代计划。',
      scope: ['技术基线', '关键风险', '责任区块划分', '迭代顺序'],
      plan: ['分析需求与约束', '确定技术基线', '细化风险与依赖', '编排后续构建迭代'],
      exitCriteria: ['架构基线已记录', '风险与依赖已排序', '构建迭代计划已确定'],
      deliverables: ['架构基线说明', '风险更新清单', '迭代计划'],
      ownerRoleId: planner.id,
      feedbackTargetRoleId: evaluator.id,
      status: 'planned',
    },
  ];

  developerRoles.forEach((role, index) => {
    iterations.push({
      id: `construction-${index + 1}`,
      phaseId: 'construction',
      name: iterationNameForDeveloper(role, index),
      objective: `按迭代协议完成“${role.name}”责任区块的交付并通过评估。`,
      scope: role.responsibilities,
      plan: ['制定本迭代的迭代协议', '完成实现与测试', '提交评估与反馈闭环'],
      exitCriteria: ['迭代协议中的交付物已产出', '评估者校验通过', '遗留问题已记录'],
      deliverables: role.deliverables,
      ownerRoleId: role.id,
      feedbackTargetRoleId: evaluator.id,
      status: 'planned',
    });
  });

  if (developerRoles.length === 0) {
    iterations.push({
      id: 'construction-1',
      phaseId: 'construction',
      name: '核心功能开发迭代',
      objective: `围绕“${requirement}”完成核心可交付能力。`,
      scope: ['核心功能实现', '必要测试', '交付文档'],
      plan: ['制定本迭代的迭代协议', '完成实现与测试', '提交评估与反馈闭环'],
      exitCriteria: ['核心交付物已产出', '评估者校验通过', '遗留问题已记录'],
      deliverables: ['实现代码', '测试结果', '变更说明'],
      ownerRoleId: primaryDeveloper.id,
      feedbackTargetRoleId: evaluator.id,
      status: 'planned',
    });
  }

  iterations.push({
    id: 'transition-1',
    phaseId: 'transition',
    name: '移交验收',
    objective: '完成最终验收、文档交接和已知问题移交。',
    scope: ['最终验收', '文档交接', '已知问题清单'],
    plan: ['按退出标准做最终验收', '整理交付说明', '移交文档和已知问题'],
    exitCriteria: ['验收通过', '文档与交接清单完整', '已知问题已移交'],
    deliverables: ['验收报告', '交付说明', '已知问题清单'],
    ownerRoleId: docsRole.id,
    feedbackTargetRoleId: evaluator.id,
    status: 'planned',
  });

  const phaseDefs: Array<Omit<RupPhase, 'ownerRoleId' | 'iterationIds'>> = [
    {
      id: 'inception',
      name: '启动',
      purpose: '确认项目价值、范围、关键目标和主要风险。',
      goals: ['明确项目边界与目标', '识别核心用户和关键场景', '形成初始风险与迭代计划'],
      deliverables: ['项目范围说明', '初始风险清单', '初始迭代计划'],
      milestone: '生命周期目标',
      exitCriteria: ['范围与目标已确认', '初始风险已列出', '首个迭代已计划'],
    },
    {
      id: 'elaboration',
      name: '细化',
      purpose: '降低关键技术风险，形成可执行的架构基线和迭代计划。',
      goals: ['确定技术基线', '细化风险与依赖', '编排后续构建迭代'],
      deliverables: ['架构基线说明', '风险更新清单', '迭代计划'],
      milestone: '生命周期架构',
      exitCriteria: ['架构基线已记录', '风险与依赖已排序', '构建迭代计划已确定'],
    },
    {
      id: 'construction',
      name: '构建',
      purpose: '通过多个迭代完成责任区块的开发、测试和评估闭环。',
      goals: ['按迭代协议完成开发', '形成可运行或可验收的增量', '持续处理评估反馈'],
      deliverables: ['实现增量', '测试结果', '问题闭环记录'],
      milestone: '初始可用能力',
      exitCriteria: ['要求的责任区块已交付', '评估者校验通过', '遗留问题已记录'],
    },
    {
      id: 'transition',
      name: '移交',
      purpose: '完成最终验收、文档交接和已知问题移交。',
      goals: ['完成最终验收', '完善运行与交接文档', '移交已知问题'],
      deliverables: ['验收报告', '交付说明', '已知问题清单'],
      milestone: '产品发布',
      exitCriteria: ['验收通过', '文档与交接清单完整', '已知问题已移交'],
    },
  ];

  const phases: RupPhase[] = phaseDefs.map((phase) => ({
    ...phase,
    ownerRoleId:
      phase.id === 'construction'
        ? primaryDeveloper.id
        : phase.id === 'transition'
          ? docsRole.id
          : planner.id,
    iterationIds: iterations
      .filter((iteration) => iteration.phaseId === phase.id)
      .map((iteration) => iteration.id),
  }));

  return {
    framework: 'rup',
    currentPhaseId: 'inception',
    phases,
    iterations,
    rules: RUP_RULES,
  };
}

function normalizePhase(
  raw: unknown,
  fallback: RupPhase,
  agents: AgentRole[]
): RupPhase {
  const value = (raw ?? {}) as Record<string, unknown>;
  const ownerRoleId =
    typeof value.ownerRoleId === 'string' && roleById(agents, value.ownerRoleId)
      ? value.ownerRoleId
      : fallback.ownerRoleId;
  return {
    id: fallback.id,
    name: text(value.name, fallback.name),
    purpose: text(value.purpose, fallback.purpose),
    goals: stringArray(value.goals, fallback.goals),
    deliverables: stringArray(value.deliverables, fallback.deliverables),
    milestone: text(value.milestone, fallback.milestone),
    exitCriteria: stringArray(value.exitCriteria, fallback.exitCriteria),
    ownerRoleId,
    iterationIds: [],
  };
}

function normalizeIteration(
  raw: unknown,
  fallback: RupIteration,
  agents: AgentRole[]
): RupIteration {
  const value = (raw ?? {}) as Record<string, unknown>;
  const ownerRoleId =
    typeof value.ownerRoleId === 'string' && roleById(agents, value.ownerRoleId)
      ? value.ownerRoleId
      : fallback.ownerRoleId;
  const feedbackTargetRoleId =
    typeof value.feedbackTargetRoleId === 'string' &&
    roleById(agents, value.feedbackTargetRoleId)
      ? value.feedbackTargetRoleId
      : fallback.feedbackTargetRoleId;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : fallback.id,
    phaseId: phaseId(value.phaseId, fallback.phaseId),
    name: text(value.name, fallback.name),
    objective: text(value.objective, fallback.objective),
    scope: stringArray(value.scope, fallback.scope),
    plan: stringArray(value.plan, fallback.plan),
    exitCriteria: stringArray(value.exitCriteria, fallback.exitCriteria),
    deliverables: stringArray(value.deliverables, fallback.deliverables),
    ownerRoleId,
    feedbackTargetRoleId,
    status: iterationStatus(value.status, fallback.status),
  };
}

export function normalizeProcessManagement(
  raw: unknown,
  fallback: ProcessManagement,
  agents: AgentRole[]
): ProcessManagement {
  const value = (raw ?? {}) as Record<string, unknown>;
  const rawPhases = Array.isArray(value.phases) ? value.phases : [];
  const rawIterations = Array.isArray(value.iterations) ? value.iterations : [];
  const phases = fallback.phases.map((phase) =>
    normalizePhase(
      rawPhases.find((item) => {
        const candidate = (item ?? {}) as Record<string, unknown>;
        return candidate.id === phase.id;
      }),
      phase,
      agents
    )
  );

  let iterations: RupIteration[];
  if (rawIterations.length === 0) {
    iterations = fallback.iterations;
  } else {
    const seen = new Set<string>();
    iterations = rawIterations
      .map((item) => {
        const candidate = (item ?? {}) as Record<string, unknown>;
        const fallbackIteration =
          fallback.iterations.find((iteration) => iteration.id === candidate.id) ??
          fallback.iterations[0];
        return normalizeIteration(item, fallbackIteration, agents);
      })
      .filter((iteration) => {
        const id = iteration.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 12);
    for (const fallbackIteration of fallback.iterations) {
      const phaseCovered = iterations.some(
        (iteration) => iteration.phaseId === fallbackIteration.phaseId
      );
      if (!phaseCovered && !seen.has(fallbackIteration.id)) {
        iterations.push(fallbackIteration);
        seen.add(fallbackIteration.id);
      }
    }
  }

  const phasesWithIterations = phases.map((phase) => ({
    ...phase,
    iterationIds: iterations
      .filter((iteration) => iteration.phaseId === phase.id)
      .map((iteration) => iteration.id),
  }));

  return {
    framework: 'rup',
    currentPhaseId: phaseId(
      value.currentPhaseId,
      fallback.currentPhaseId
    ),
    phases: phasesWithIterations,
    iterations,
    rules: stringArray(value.rules, fallback.rules),
  };
}

function replaceSprint(value: string): string {
  return value
    .replace(/冲刺协议/g, '迭代协议')
    .replace(/每项任务开始前/g, '每个迭代开始前')
    .replace(/按冲刺/g, '按迭代');
}

function migrateWorkflowStep(step: WorkflowStep): WorkflowStep {
  return {
    ...step,
    name: replaceSprint(step.name),
    description: replaceSprint(step.description),
  };
}

function migrateAgentRole(role: AgentRole): AgentRole {
  return {
    ...role,
    mission: replaceSprint(role.mission),
    responsibilities: role.responsibilities.map(replaceSprint),
    skills: role.skills.map(replaceSprint),
    tools: role.tools.map(replaceSprint),
    deliverables: role.deliverables.map(replaceSprint),
    dependsOn: role.dependsOn.map(replaceSprint),
    notifies: role.notifies.map(replaceSprint),
  };
}

export function migrateTeamToV2(team: TeamConfig | null): TeamConfig | null {
  if (!team) return null;
  if (team.schemaVersion === 2 && team.processManagement) return team;

  const legacy = team as TeamConfig & {
    schemaVersion: 1 | 2;
    processManagement?: unknown;
  };
  const agents = Array.isArray(legacy.agents)
    ? legacy.agents.map(migrateAgentRole)
    : [];
  const fallback = buildProcessManagement(
    agents,
    legacy.requirement ?? '',
    Array.isArray(legacy.techStackHints) ? legacy.techStackHints : []
  );

  return {
    ...legacy,
    schemaVersion: 2,
    workflow: Array.isArray(legacy.workflow)
      ? legacy.workflow.map(migrateWorkflowStep)
      : [],
    agents,
    processManagement: legacy.processManagement
      ? normalizeProcessManagement(legacy.processManagement, fallback, agents)
      : fallback,
  };
}
