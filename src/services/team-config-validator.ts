import * as fs from 'fs';
import * as path from 'path';
import {
  AgentRole,
  AgentRoleKind,
  ProcessPhaseId,
  TeamConfig,
  TeamValidationIssue,
  TeamValidationResult,
} from '../shared/types';
import { inferAgentRoleKind, isAgentRoleKind } from './agent-role-kind';
import { safeAgentFileName } from './harness-templates';
import { normalizeProcessManagement } from './process-management';
import {
  buildTeamConfig,
  dedupeAgentIds,
  ensureRupWorkflow,
  RUP_WORKFLOW_STEPS,
} from './requirement-analyzer';

const REQUIRED_PHASE_IDS: ProcessPhaseId[] = [
  'inception',
  'elaboration',
  'construction',
  'transition',
];

const REQUIRED_WORKFLOW_STEP_NAMES = RUP_WORKFLOW_STEPS.map((step) => step.name);

function issue(
  severity: TeamValidationIssue['severity'],
  issuePath: string,
  message: string
): TeamValidationIssue {
  return { severity, path: issuePath, message };
}

function emptyResult(): TeamValidationResult {
  return { ok: true, errors: [], warnings: [], repairs: [] };
}

function fallbackFor(team: TeamConfig): TeamConfig {
  return buildTeamConfig({
    projectName: team.projectName || '未命名项目',
    requirement: team.requirement || '',
    techStackHints: team.techStackHints.join('、'),
  });
}

function fallbackRoleByKind(team: TeamConfig, kind: AgentRoleKind): AgentRole {
  return fallbackFor(team).agents.find((agent) => agent.kind === kind) ?? fallbackFor(team).agents[0];
}

function normalizeDependencies(
  agents: AgentRole[],
  repairs: string[]
): AgentRole[] {
  const names = new Set(agents.map((agent) => agent.name));
  return agents.map((agent) => {
    const dependsOn = agent.dependsOn.filter((name) => names.has(name));
    const notifies = agent.notifies.filter((name) => names.has(name));
    const repaired =
      dependsOn.length !== agent.dependsOn.length ||
      notifies.length !== agent.notifies.length;
    if (repaired) {
      repairs.push(`角色“${agent.name}”移除了不存在的依赖/通知角色名`);
    }
    return { ...agent, dependsOn, notifies };
  });
}

export function repairTeamConfig(team: TeamConfig): TeamConfig {
  const repairs: string[] = [];
  let agents = (team.agents ?? []).map((agent) => ({
    ...agent,
    kind: isAgentRoleKind(agent.kind) ? agent.kind : inferAgentRoleKind(agent.name),
  }));
  agents = dedupeAgentIds(agents);

  let plannerKept = false;
  let evaluatorKept = false;
  agents = agents.map((agent) => {
    if (agent.kind === 'planner') {
      if (plannerKept) {
        repairs.push(`角色“${agent.name}”由规划者降级为自定义角色`);
        return { ...agent, kind: 'custom' as const };
      }
      plannerKept = true;
    }
    if (agent.kind === 'evaluator') {
      if (evaluatorKept) {
        repairs.push(`角色“${agent.name}”由评估者降级为自定义角色`);
        return { ...agent, kind: 'custom' as const };
      }
      evaluatorKept = true;
    }
    return agent;
  });

  if (!plannerKept) {
    const planner = fallbackRoleByKind(team, 'planner');
    agents.unshift(planner);
    repairs.push(`补充了缺失的规划者角色“${planner.name}”`);
  }
  if (!evaluatorKept) {
    const evaluator = fallbackRoleByKind(team, 'evaluator');
    agents.unshift(evaluator);
    repairs.push(`补充了缺失的评估者角色“${evaluator.name}”`);
  }
  if (!agents.some((agent) => agent.kind === 'developer')) {
    const developer = fallbackRoleByKind(team, 'developer');
    agents.push(developer);
    repairs.push(`补充了缺失的开发者角色“${developer.name}”`);
  }

  agents = normalizeDependencies(agents, repairs);

  const fallback = fallbackFor({ ...team, agents });
  const workflow = ensureRupWorkflow(team.workflow ?? [], agents);
  const processManagement = normalizeProcessManagement(
    team.processManagement ?? undefined,
    fallback.processManagement,
    agents
  );
  const roleIdByKind = (kind: AgentRoleKind): string =>
    agents.find((agent) => agent.kind === kind)?.id ?? agents[0]?.id ?? '';
  const repairedProcessManagement = {
    ...processManagement,
    phases: processManagement.phases.map((phase) => ({
      ...phase,
      ownerRoleId: agents.some((agent) => agent.id === phase.ownerRoleId)
        ? phase.ownerRoleId
        : roleIdByKind('planner'),
    })),
    iterations: processManagement.iterations.map((iteration) => ({
      ...iteration,
      ownerRoleId: agents.some((agent) => agent.id === iteration.ownerRoleId)
        ? iteration.ownerRoleId
        : roleIdByKind(iteration.phaseId === 'construction' ? 'developer' : 'planner'),
      feedbackTargetRoleId: agents.some(
        (agent) => agent.id === iteration.feedbackTargetRoleId
      )
        ? iteration.feedbackTargetRoleId
        : roleIdByKind('evaluator'),
    })),
  };
  const conventions = {
    branch: team.conventions?.branch?.trim() || fallback.conventions.branch,
    commits: team.conventions?.commits?.trim() || fallback.conventions.commits,
    pullRequests:
      team.conventions?.pullRequests?.trim() || fallback.conventions.pullRequests,
    testing: team.conventions?.testing?.trim() || fallback.conventions.testing,
    documentation:
      team.conventions?.documentation?.trim() || fallback.conventions.documentation,
  };

  return {
    ...team,
    schemaVersion: 3,
    agents,
    workflow,
    processManagement: repairedProcessManagement,
    conventions,
    generationLog: team.generationLog ?? [],
  };
}

export function validateTeamConfig(team: TeamConfig): TeamValidationResult {
  const result = emptyResult();
  const addError = (issuePath: string, message: string): void => {
    result.errors.push(issue('error', issuePath, message));
    result.ok = false;
  };
  const addWarning = (issuePath: string, message: string): void => {
    result.warnings.push(issue('warning', issuePath, message));
  };

  if (team.schemaVersion !== 3) {
    addError('schemaVersion', `schemaVersion 必须是 3，当前为 ${team.schemaVersion}`);
  }
  if (!team.agents || team.agents.length === 0) {
    addError('agents', '团队至少需要规划者、评估者和一个开发者');
  }

  const agents = team.agents ?? [];
  const ids = new Set<string>();
  const names = new Set<string>();
  const roleCounts: Record<AgentRoleKind, number> = {
    planner: 0,
    evaluator: 0,
    developer: 0,
    documentation: 0,
    custom: 0,
  };

  agents.forEach((agent, index) => {
    const basePath = `agents[${index}]`;
    if (!agent.id) addError(`${basePath}.id`, '角色 ID 不能为空');
    if (ids.has(agent.id)) addError(`${basePath}.id`, `角色 ID 重复：${agent.id}`);
    ids.add(agent.id);
    if (!agent.name.trim()) addError(`${basePath}.name`, '角色名称不能为空');
    if (names.has(agent.name.trim())) {
      addError(`${basePath}.name`, `角色名称重复：${agent.name}`);
    }
    names.add(agent.name.trim());
    if (!isAgentRoleKind(agent.kind)) {
      addError(`${basePath}.kind`, `角色 kind 非法：${String(agent.kind)}`);
    } else {
      roleCounts[agent.kind] += 1;
    }
    if (!agent.mission.trim()) addError(`${basePath}.mission`, '使命不能为空');
    if (agent.responsibilities.length === 0) {
      addError(`${basePath}.responsibilities`, '职责不能为空');
    }
    if (agent.skills.length === 0) {
      addWarning(`${basePath}.skills`, '技能为空，建议补齐');
    }
    if (agent.tools.length === 0) {
      addWarning(`${basePath}.tools`, '工具为空，建议补齐');
    }
    if (agent.deliverables.length === 0) {
      addError(`${basePath}.deliverables`, '交付物不能为空');
    }
    for (const dependency of agent.dependsOn) {
      if (!agents.some((candidate) => candidate.name === dependency)) {
        addWarning(
          `${basePath}.dependsOn`,
          `依赖角色不存在：${dependency}`
        );
      }
    }
    for (const recipient of agent.notifies) {
      if (!agents.some((candidate) => candidate.name === recipient)) {
        addWarning(
          `${basePath}.notifies`,
          `通知角色不存在：${recipient}`
        );
      }
    }
  });

  if (roleCounts.planner !== 1) {
    addError('agents.kind.planner', `规划者数量必须是 1，当前为 ${roleCounts.planner}`);
  }
  if (roleCounts.evaluator !== 1) {
    addError('agents.kind.evaluator', `评估者数量必须是 1，当前为 ${roleCounts.evaluator}`);
  }
  if (roleCounts.developer < 1) {
    addError('agents.kind.developer', '至少需要一个开发者角色');
  }

  const workflowIds = new Set<string>();
  (team.workflow ?? []).forEach((step, index) => {
    const basePath = `workflow[${index}]`;
    if (!step.id) addError(`${basePath}.id`, '流程步骤 ID 不能为空');
    if (workflowIds.has(step.id)) addError(`${basePath}.id`, `流程步骤 ID 重复：${step.id}`);
    workflowIds.add(step.id);
    if (!agents.some((agent) => agent.id === step.ownerRoleId)) {
      addError(`${basePath}.ownerRoleId`, `负责人角色不存在：${step.ownerRoleId}`);
    }
  });
  for (const requiredStep of REQUIRED_WORKFLOW_STEP_NAMES) {
    if (!team.workflow?.some((step) => step.name.includes(requiredStep))) {
      addError('workflow', `缺少必要流程步骤：${requiredStep}`);
    }
  }

  const phases = team.processManagement?.phases ?? [];
  const phaseIds = phases.map((phase) => phase.id);
  if (
    phases.length !== REQUIRED_PHASE_IDS.length ||
    REQUIRED_PHASE_IDS.some((phaseId) => !phaseIds.includes(phaseId))
  ) {
    addError(
      'processManagement.phases',
      'RUP 必须包含启动、细化、构建、移交四个阶段'
    );
  }
  for (const phase of phases) {
    const basePath = `processManagement.phases[${phase.id}]`;
    if (!agents.some((agent) => agent.id === phase.ownerRoleId)) {
      addError(`${basePath}.ownerRoleId`, `阶段负责人角色不存在：${phase.ownerRoleId}`);
    }
    if (!phase.milestone.trim()) addError(`${basePath}.milestone`, '阶段里程碑不能为空');
    if (phase.exitCriteria.length === 0) {
      addError(`${basePath}.exitCriteria`, '阶段退出标准不能为空');
    }
  }

  const iterations = team.processManagement?.iterations ?? [];
  const iterationIds = new Set<string>();
  const phasesById = new Map(phases.map((phase) => [phase.id, phase]));
  for (const iteration of iterations) {
    const basePath = `processManagement.iterations[${iteration.id}]`;
    if (!iteration.id) addError(`${basePath}.id`, '迭代 ID 不能为空');
    if (iterationIds.has(iteration.id)) {
      addError(`${basePath}.id`, `迭代 ID 重复：${iteration.id}`);
    }
    iterationIds.add(iteration.id);
    if (!phaseIds.includes(iteration.phaseId)) {
      addError(`${basePath}.phaseId`, `迭代阶段不存在：${iteration.phaseId}`);
    }
    if (!agents.some((agent) => agent.id === iteration.ownerRoleId)) {
      addError(`${basePath}.ownerRoleId`, `迭代负责人角色不存在：${iteration.ownerRoleId}`);
    }
    if (!agents.some((agent) => agent.id === iteration.feedbackTargetRoleId)) {
      addError(
        `${basePath}.feedbackTargetRoleId`,
        `迭代反馈目标角色不存在：${iteration.feedbackTargetRoleId}`
      );
    }
    if (!iteration.objective.trim()) addError(`${basePath}.objective`, '迭代目标不能为空');
    if (iteration.exitCriteria.length === 0) {
      addError(`${basePath}.exitCriteria`, '迭代退出标准不能为空');
    }
  }

  for (const phase of phases) {
    for (const iterationId of phase.iterationIds) {
      if (!iterations.some((iteration) => iteration.id === iterationId)) {
        addError(
          `processManagement.phases[${phase.id}].iterationIds`,
          `阶段引用了不存在的迭代：${iterationId}`
        );
      }
    }
  }
  for (const iteration of iterations) {
    const phase = phasesById.get(iteration.phaseId);
    if (phase && !phase.iterationIds.includes(iteration.id)) {
      addError(
        `processManagement.phases[${phase.id}].iterationIds`,
        `阶段未收录迭代：${iteration.id}`
      );
    }
  }

  if (
    !team.processManagement ||
    !phaseIds.includes(team.processManagement.currentPhaseId)
  ) {
    addError(
      'processManagement.currentPhaseId',
      '当前 RUP 阶段必须是启动、细化、构建、移交之一'
    );
  }

  for (const key of ['branch', 'commits', 'pullRequests', 'testing', 'documentation'] as const) {
    if (!team.conventions?.[key]?.trim()) {
      addError(`conventions.${key}`, `工程约定“${key}”不能为空`);
    }
  }

  return result;
}

export function validateGeneratedHarness(
  targetDirectory: string,
  team: TeamConfig,
  createdFiles: string[] = []
): TeamValidationResult {
  const result = emptyResult();
  const addError = (issuePath: string, message: string): void => {
    result.errors.push(issue('error', issuePath, message));
    result.ok = false;
  };
  const addWarning = (issuePath: string, message: string): void => {
    result.warnings.push(issue('warning', issuePath, message));
  };
  const absolute = path.resolve(targetDirectory);

  const requiredFiles = [
    'AGENTS.team.md',
    'agents.json',
    'feature_list.json',
    'progress.md',
    'session-handoff.md',
    'quality-document.md',
    'evaluator-rubric.md',
    'clean-state-checklist.md',
    'init.sh',
    'docs/PROCESS.md',
  ];
  for (const filename of requiredFiles) {
    if (!fs.existsSync(path.join(absolute, filename))) {
      addError(filename, `harness 文件缺失：${filename}`);
    }
  }

  if (!fs.existsSync(path.join(absolute, 'agents'))) {
    addError('agents/', 'agents/ 目录缺失');
  }

  team.agents.forEach((agent, index) => {
    const filename = `${'agents'}/${safeAgentFileName(agent, index)}`;
    const filePath = path.join(absolute, filename);
    if (!fs.existsSync(filePath)) {
      addError(filename, `角色规则文件缺失：${filename}`);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.includes(agent.name)) {
      addWarning(filename, `角色规则文件未包含角色名：${agent.name}`);
    }
  });

  const teamRulesPath = path.join(absolute, 'AGENTS.team.md');
  if (fs.existsSync(teamRulesPath)) {
    const content = fs.readFileSync(teamRulesPath, 'utf-8');
    team.agents.forEach((agent, index) => {
      const filename = `${'agents'}/${safeAgentFileName(agent, index)}`;
      if (!content.includes(filename)) {
        addError('AGENTS.team.md', `团队路由缺少角色文件：${filename}`);
      }
    });
  }

  const agentsJsonPath = path.join(absolute, 'agents.json');
  if (fs.existsSync(agentsJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(agentsJsonPath, 'utf-8')) as {
        schemaVersion?: number;
        agents?: AgentRole[];
      };
      if (parsed.schemaVersion !== 3) {
        addError('agents.json', `agents.json schemaVersion 必须是 3，当前为 ${parsed.schemaVersion}`);
      }
      if (parsed.agents?.length !== team.agents.length) {
        addError('agents.json', 'agents.json 角色数量与当前团队不一致');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addError('agents.json', `agents.json 无法解析：${message}`);
    }
  }

  for (const [ruleFile, marker] of [
    ['AGENTS.md', '智能体地图'],
    ['CLAUDE.md', '智能体地图'],
  ] as const) {
    const rulePath = path.join(absolute, ruleFile);
    if (!fs.existsSync(rulePath)) continue;
    const content = fs.readFileSync(rulePath, 'utf-8');
    if (createdFiles.includes(ruleFile)) {
      if (!content.includes(marker)) {
        addError(ruleFile, `新生成的 ${ruleFile} 缺少智能体地图`);
      }
      team.agents.forEach((agent, index) => {
        const filename = `${'agents'}/${safeAgentFileName(agent, index)}`;
        if (!content.includes(filename)) {
          addError(ruleFile, `${ruleFile} 智能体地图缺少角色文件：${filename}`);
        }
      });
    } else if (
      !content.includes('使用智能体规则在 AGENTS.team.md 文件') &&
      !(content.includes(marker) && content.includes('AGENTS.team.md'))
    ) {
      addError(ruleFile, `已有 ${ruleFile} 缺少指向 AGENTS.team.md 的规则入口`);
    }
  }

  const featureListPath = path.join(absolute, 'feature_list.json');
  if (fs.existsSync(featureListPath)) {
    const featureListCreated = createdFiles.includes('feature_list.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(featureListPath, 'utf-8')) as {
        features?: Array<{ id?: string; status?: string }>;
      };
      if (!parsed.features?.some((feature) => feature.id === 'harness-bootstrap')) {
        if (featureListCreated) {
          addError('feature_list.json', 'feature_list.json 缺少 harness-bootstrap 条目');
        } else {
          addWarning('feature_list.json', '已有 feature_list.json 缺少 harness-bootstrap 条目');
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (featureListCreated) {
        addError('feature_list.json', `feature_list.json 无法解析：${message}`);
      } else {
        addWarning('feature_list.json', `已有 feature_list.json 无法解析：${message}`);
      }
    }
  }

  const processDocPath = path.join(absolute, 'docs/PROCESS.md');
  if (
    fs.existsSync(processDocPath) &&
    !fs.readFileSync(processDocPath, 'utf-8').includes('迭代协议')
  ) {
    if (createdFiles.includes('docs/PROCESS.md')) {
      addError('docs/PROCESS.md', 'docs/PROCESS.md 缺少迭代协议');
    } else {
      addWarning('docs/PROCESS.md', '已有 docs/PROCESS.md 缺少迭代协议');
    }
  }

  for (const [scoringFile, marker] of [
    ['quality-document.md', '质量文档'],
    ['evaluator-rubric.md', '评审评分表'],
    ['clean-state-checklist.md', '干净状态检查清单'],
  ] as const) {
    const scoringPath = path.join(absolute, scoringFile);
    if (!fs.existsSync(scoringPath)) continue;
    const content = fs.readFileSync(scoringPath, 'utf-8');
    if (createdFiles.includes(scoringFile)) {
      if (!content.includes(`-- ${team.projectName}`)) {
        addError(scoringFile, `新生成的 ${scoringFile} 缺少项目名`);
      }
      if (!content.includes(marker)) {
        addError(scoringFile, `新生成的 ${scoringFile} 缺少${marker}标记`);
      }
    } else if (!content.includes(marker)) {
      addWarning(scoringFile, `已有 ${scoringFile} 缺少${marker}标记`);
    }
  }

  const initPath = path.join(absolute, 'init.sh');
  if (fs.existsSync(initPath)) {
    const mode = fs.statSync(initPath).mode;
    if ((mode & 0o111) === 0) {
      if (createdFiles.includes('init.sh')) {
        addError('init.sh', 'init.sh 不是可执行文件');
      } else {
        addWarning('init.sh', '已有 init.sh 不是可执行文件');
      }
    }
  }

  return result;
}

export function formatValidationErrors(result: TeamValidationResult): string {
  return result.errors.map((item) => `${item.path}: ${item.message}`).join('\n');
}
