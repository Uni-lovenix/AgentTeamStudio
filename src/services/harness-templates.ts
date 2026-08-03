import { AgentRole, TeamConfig } from '../shared/types';

export const HARNESS_FILE_PATHS = [
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
] as const;

export function safeAgentFileName(agent: AgentRole, index: number): string {
  const base =
    agent.name
      .trim()
      .replace(/[\\/:*?"<>|#%{}~^[\]]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 80) || `agent-${index + 1}`;
  return `${String(index + 1).padStart(2, '0')}-${base}.md`;
}

function roleName(team: TeamConfig, roleId?: string): string {
  return team.agents.find((agent) => agent.id === roleId)?.name ?? '待分配';
}

function currentIterationName(team: TeamConfig): string {
  return (
    team.processManagement.iterations.find(
      (iteration) => iteration.phaseId === team.processManagement.currentPhaseId
    )?.name ?? '未指定'
  );
}

function safeFeatureId(value: string, fallbackIndex: number): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
  return cleaned ? `feat-${cleaned}` : `feat-construction-${fallbackIndex + 1}`;
}

function agentMapSection(team: TeamConfig): string {
  return team.agents
    .map(
      (agent, index) =>
        `- ${agent.name}：\`agents/${safeAgentFileName(agent, index)}\``
    )
    .join('\n');
}

function ruleMapSection(): string {
  return `## 规则地图

- \`AGENTS.team.md\`：团队级规则、RUP 过程、智能体路由、协作流程与工程约定。
- \`agents.json\`：schema v3 机器可读团队配置。
- \`agents/<角色文件>\`：当前职责的详细规则，按下方智能体地图定位。
- \`feature_list.json\`：功能状态追踪。
- \`progress.md\`：会话进度和当前已验证状态。
- \`session-handoff.md\`：跨会话交接记录。
- \`quality-document.md\`：质量快照、评级标准和待补证据。
- \`evaluator-rubric.md\`：迭代验收前的评分表和结论。
- \`clean-state-checklist.md\`：会话结束前和提交前要完成的干净状态检查。
- \`docs/PROCESS.md\`：RUP 阶段、迭代协议和退出标准。
`;
}

function phaseRows(team: TeamConfig): string {
  return team.processManagement.phases
    .map((phase) => {
      const status = phase.id === team.processManagement.currentPhaseId ? '当前' : '待进入';
      const iterations = phase.iterationIds
        .map((id) => team.processManagement.iterations.find((iteration) => iteration.id === id)?.name)
        .filter(Boolean)
        .join('、');
      return `| ${phase.name} | ${phase.purpose} | ${phase.milestone} | ${status} | ${iterations || '无'} |`;
    })
    .join('\n');
}

export function renderAgentsRules(team: TeamConfig): string {
  return `# AGENTS.md -- ${team.projectName}

> 本文件由 Agent Team Studio 生成，是规则和智能体地图；角色详情按地图读取对应文件。

${ruleMapSection()}
## 智能体地图

${agentMapSection(team)}

## 使用规则

- 每个智能体只读取 \`智能体地图\` 中分配给自己的角色文件，不一次性加载所有角色文件。
- 先读取 \`AGENTS.team.md\` 了解当前阶段、迭代、路由和协作流程，再读取当前职责对应的 \`agents/<角色文件>\`。
`;
}

export function renderClaudeRules(team: TeamConfig): string {
  return `# CLAUDE.md -- ${team.projectName}

> 本文件由 Agent Team Studio 生成，是规则和智能体地图；角色详情按地图读取对应文件。

${ruleMapSection()}
## 智能体地图

${agentMapSection(team)}

## 使用规则

- 每个智能体只读取 \`智能体地图\` 中分配给自己的角色文件，不一次性加载所有角色文件。
- 先读取 \`AGENTS.team.md\` 了解当前阶段、迭代、路由和协作流程，再读取当前职责对应的 \`agents/<角色文件>\`。
`;
}

export function renderFeatureList(team: TeamConfig): string {
  const constructionIterations = team.processManagement.iterations.filter(
    (iteration) => iteration.phaseId === 'construction'
  );
  const featureIds: string[] = [];
  const constructionFeatures = constructionIterations.map((iteration, index) => {
    const id = safeFeatureId(iteration.id, index);
    featureIds.push(id);
    return {
      id,
      name: iteration.name,
      description: iteration.objective,
      dependencies: index === 0 ? ['harness-bootstrap'] : [featureIds[index - 1]],
      status: 'not_started',
      evidence: '',
      rupPhase: 'construction',
      iteration: iteration.id,
      ownerRole: roleName(team, iteration.ownerRoleId),
    };
  });
  const lastConstructionId =
    constructionFeatures[constructionFeatures.length - 1]?.id ?? 'harness-bootstrap';
  const features = [
    {
      id: 'harness-bootstrap',
      name: 'Harness and Team Bootstrap',
      description: '初始化 RUP harness 文件、评分文件、多智能体团队配置和规则入口。',
      dependencies: [],
      status: 'pass',
      evidence: `已生成 ${HARNESS_FILE_PATHS.join('、')}、AGENTS.team.md、agents.json 和 agents/ 角色文件。`,
      testedAt: team.createdAt,
      rupPhase: 'inception',
      iteration: 'harness-bootstrap',
      ownerRole: 'Agent Team Studio',
    },
    ...constructionFeatures,
    {
      id: 'feat-transition-handoff',
      name: '移交与文档交接',
      description: '完成最终验收、运行与交付文档、已知问题清单和跨会话交接。',
      dependencies: [lastConstructionId],
      status: 'not_started',
      evidence: '',
      rupPhase: 'transition',
      iteration: 'transition-1',
      ownerRole: roleName(team, team.processManagement.iterations.find((iteration) => iteration.id === 'transition-1')?.ownerRoleId),
    },
  ];

  return `${JSON.stringify(
    {
      project: team.projectName,
      description: team.requirement,
      last_updated: team.createdAt,
      status_legend: {
        not_started: '功能还没开始做。',
        in_progress: '这个功能是当前唯一正在进行的任务。',
        blocked: '还在规划中。',
        pass: '要求的验证已经通过，并且证据已经记录。',
      },
      features,
    },
    null,
    2
  )}\n`;
}

export function renderProgress(team: TeamConfig): string {
  return `# Session Progress Log

## Current State

**Last Updated:** ${team.createdAt}
**Active Feature:** 无
**Current RUP Phase:** ${team.processManagement.currentPhaseId}
**Current Iteration:** ${currentIterationName(team)}

## Status

### What's Done

- [x] RUP harness 和团队配置已初始化。
- [x] \`quality-document.md\`、\`evaluator-rubric.md\` 和 \`clean-state-checklist.md\` 已初始化。
- [x] \`AGENTS.team.md\`、\`agents.json\`、\`agents/\` 已生成。
- [x] \`AGENTS.md\` / \`CLAUDE.md\` 默认规则入口已初始化。

### What's In Progress

- 当前没有激活的 feature；保持一次只处理一个 \`not_started\` feature。

### What's Next

1. 读取 \`feature_list.json\`，选择第一个未开始的 construction feature。
2. 读取 \`AGENTS.team.md\` 和 \`agents/\` 中对应角色的规则文件。
3. 为当前迭代编写迭代协议，并按协议实现、测试、评估、复盘。
4. 验证通过后更新 \`feature_list.json\` 和 \`progress.md\`。

## Blockers / Risks

- 尚未识别阻塞项。

## Decisions Made

- 使用 RUP 四阶段和迭代协议管理长生成项目。
- 使用 \`feature_list.json\` 作为功能状态单一事实源。
- 使用 \`session-handoff.md\` 和 \`progress.md\` 支持跨会话恢复。

## Notes for Next Session

先运行 \`bash init.sh\` 确认基线健康，再从 \`feature_list.json\` 选择唯一一个未完成 feature。
`;
}

export function renderSessionHandoff(team: TeamConfig): string {
  return `# Session Handoff -- ${team.projectName}

## Current Objective

- Goal: ${team.requirement}
- Current status: RUP harness 和团队配置已初始化；具体实现尚未开始。
- Branch / commit: 待当前会话填写

## Completed This Session

- [x] 生成了多智能体团队配置。
- [x] 初始化了 RUP harness 文件。
- [x] 初始化了 \`quality-document.md\`、\`evaluator-rubric.md\` 和 \`clean-state-checklist.md\`。
- [x] 初始化了 \`AGENTS.md\` 和 \`CLAUDE.md\` 规则入口。

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| 团队配置存在 | \`ls AGENTS.team.md agents.json\` | 待填写 | 由 Agent Team Studio 生成 |
| 角色文件存在 | \`ls agents\` | 待填写 | 每个角色一个文件 |
| Harness 文件存在 | \`ls AGENTS.md CLAUDE.md feature_list.json progress.md quality-document.md evaluator-rubric.md clean-state-checklist.md init.sh docs/PROCESS.md\` | 待填写 | 缺失时自动创建 |
| 标准验证 | \`bash init.sh\` | 待填写 | 进入实现前必须运行 |

## Files Changed

- \`AGENTS.team.md\`
- \`agents.json\`
- \`agents/*.md\`
- \`AGENTS.md\`
- \`CLAUDE.md\`
- \`feature_list.json\`
- \`progress.md\`
- \`session-handoff.md\`
- \`quality-document.md\`
- \`evaluator-rubric.md\`
- \`clean-state-checklist.md\`
- \`init.sh\`
- \`docs/PROCESS.md\`

## Decisions Made

- 使用 RUP 启动、细化、构建、移交四阶段管理项目。
- 每个迭代开始前由规划者制定迭代协议。
- 评估者按迭代协议反馈给对应开发者，直到通过。

## Blockers / Risks

- 当前无已知 blocker。

## Next Session Startup

1. Read \`AGENTS.md\` and \`CLAUDE.md\`.
2. Read \`feature_list.json\` and \`progress.md\`.
3. Review this handoff.
4. Run \`bash init.sh\` before editing.

## Recommended Next Step

选择 \`feature_list.json\` 中第一个 \`not_started\` 的 construction feature，并按 RUP 迭代协议开始实现。
`;
}

export function renderProcessDoc(team: TeamConfig): string {
  const iterationRows = team.processManagement.iterations
    .map((iteration) => {
      return `| ${iteration.name} | ${iteration.phaseId} | ${roleName(team, iteration.ownerRoleId)} | ${iteration.objective} | ${iteration.exitCriteria.join('；')} |`;
    })
    .join('\n');

  return `# RUP 过程管理 -- ${team.projectName}

> 本文件由 Agent Team Studio 生成，用于管理长时间、多会话的智能体开发项目。

## 阶段

| 阶段 | 目的 | 里程碑 | 当前状态 | 迭代 |
|---|---|---|---|---|
${phaseRows(team)}

## 迭代协议

每个迭代开始前，规划者必须制定迭代协议，包含：

- 迭代目标
- 迭代范围
- 实施计划
- 交付物
- 退出标准

开发者按迭代协议开发；评估者按迭代协议和退出标准校验，发现问题反馈给对应开发者修改，通过后进入下一迭代或阶段验收。

## 当前迭代

当前阶段：${team.processManagement.currentPhaseId}

当前迭代：${currentIterationName(team)}

## 迭代列表

| 迭代 | 阶段 | 负责人 | 目标 | 退出标准 |
|---|---|---|---|---|
${iterationRows}

## 不引入的部分

不新增业务分析师、架构师、测试工程师、部署工程师或项目经理等独立 RUP 角色；保留阶段与里程碑、迭代协议、风险驱动、评估反馈、阶段验收、文档交接和已知问题移交。
`;
}

const QUALITY_DIMENSIONS = [
  ['构建与编译', '类型检查、构建与项目自有验证脚本能否无错运行。'],
  ['功能完整性', '需求目标、用户价值与责任区块是否都得到实现和验证。'],
  ['需求与团队配置', '规划者、评估者、开发者角色与需求责任区块是否匹配。'],
  ['RUP 过程管理', '启动、细化、构建、移交阶段和迭代协议是否可追溯。'],
  ['协作与评估闭环', '迭代协议、开发、评估反馈、复盘和阶段验收是否闭环。'],
  ['规则地图与角色文件', 'AGENTS.md / CLAUDE.md 是否能按地图定位并读取单个角色文件。'],
  ['导出 Harness', 'AGENTS.team.md、agents.json、评分文件和状态文件是否完整一致。'],
  ['验证与证据', 'feature_list.json、progress.md 和评分表是否记录真实证据。'],
  ['文档与交接', '架构、产品、可靠性说明和 session-handoff 是否足够下一会话继续。'],
] as const;

export function renderQualityDocument(team: TeamConfig): string {
  const rows = QUALITY_DIMENSIONS.map(
    ([dimension, gap]) =>
      `| ${dimension} | 待评估 | 待验证 | 待评估 | 待评估 | ${gap} | ${team.createdAt} |`
  ).join('\n');

  return `# 质量文档 -- ${team.projectName}

> 本文件由 Agent Team Studio 生成，是项目质量快照和评分入口。每轮重要会话结束后，或开始新一阶段工作前更新。

## 评级标准

- **A**：验证全部通过，架构干净，agent 能读懂，测试稳定。
- **B**：验证通过，基本干净，可读性或测试覆盖有少量缺口。
- **C**：部分可用，有已知缺口，部分代码 agent 不容易理解。
- **D**：不可用，或存在重大结构问题。

## 评分汇总

| 维度 | 评级 | 验证状态 | Agent 可读性 | 测试稳定性 | 关键缺口 | 上次更新 |
|------|------|---------|-------------|-----------|---------|---------|
${rows}

## Overall Grade: 待评估

## 当前快照

- 项目：${team.projectName}
- 需求：${team.requirement}
- 生成方式：${team.generatedBy === 'llm' ? 'LLM 辅助生成' : '需求驱动生成'}
- 当前 RUP 阶段：${team.processManagement.currentPhaseId}
- 当前迭代：${currentIterationName(team)}
- 智能体数量：${team.agents.length}
- 已生成文件：${HARNESS_FILE_PATHS.join('、')}、AGENTS.team.md、agents.json、agents/

## 验证命令

按目标项目实际可用脚本执行，并把结果填入验证状态：

- \`npm run check\`
- \`npm test\`
- \`npm run build\`
- \`bash init.sh\`
- \`bash scripts/benchmark.sh\`（如存在）
- \`bash scripts/cleanup-scanner.sh\`（如存在）

## Evidence of Quality

### Build

- 类型检查与构建：待填写
- 项目自有验证脚本：待填写
- Harness 初始化：待填写

### Runtime

- 应用启动和核心流程：待填写
- 团队配置导出：待填写
- 状态文件与评分文件更新：待填写

### Observability

- 结构化日志覆盖：待填写
- 关键服务事件证据：待填写

### Performance

- \`bash scripts/benchmark.sh\` 结果：待填写
- 本地分析与导出耗时：待填写

## Verified Against

| 证据 | 状态 |
| --- | --- |
| \`clean-state-checklist.md\` | 待验证 |
| \`evaluator-rubric.md\` | 待填写 |
| \`feature_list.json\` | 待填写 |
| \`bash scripts/benchmark.sh\` | 待运行 |
| \`bash scripts/cleanup-scanner.sh\` | 待运行 |
`;
}

const EVALUATOR_RUBRIC_DIMENSIONS = [
  ['正确性', '实现出来的行为是否符合目标功能和迭代协议？'],
  ['验证', '要求的检查是否真的跑过，并留下证据？'],
  ['范围纪律', '这一轮是否基本保持在选定功能范围内？'],
  ['可靠性', '结果是否能在重启或重跑后继续工作？'],
  ['可维护性', '代码和文档是否清楚到足以交给下一轮会话？'],
  ['交接准备度', '新会话是否能只靠仓库内工件继续推进？'],
] as const;

export function renderEvaluatorRubric(team: TeamConfig): string {
  const evaluatorId = team.agents.find((agent) => agent.kind === 'evaluator')?.id;
  const rows = EVALUATOR_RUBRIC_DIMENSIONS.map(
    ([dimension, question]) =>
      `| ${dimension} | ${question} |  |  |`
  ).join('\n');
  const harnessFileRows = ['AGENTS.team.md', 'agents.json', ...HARNESS_FILE_PATHS, 'agents/<角色文件>']
    .map((file) => `| \`${file}\` | 是 | 待评估 | 由 Agent Team Studio 初始化 |`)
    .join('\n');

  return `# 评审评分表 -- ${team.projectName}

> 本文件由 Agent Team Studio 生成。评估者在迭代验收前按迭代协议填写，并作为质量文档的评审证据。

## 当前评审上下文

- 当前 RUP 阶段：${team.processManagement.currentPhaseId}
- 当前迭代：${currentIterationName(team)}
- 评估者：${roleName(team, evaluatorId)}

## 评分规则

- **5 分**：满足全部验收证据，无需修订。
- **4 分**：核心满足，仅存在少量非阻塞打磨项。
- **3 分**：核心基本满足，需要计划内修订并复审。
- **2 分**：存在明显缺口，验收前必须修订。
- **1 分**：存在阻塞问题，当前不可验收。

## 评分维度

| 维度 | 问题 | 分数 (1-5) | 备注 |
| --- | --- | --- | --- |
${rows}

## 总体评分

**Overall: 待评估 / 5**

## Harness 文件评估

| 文件 | Present | Quality | Notes |
| --- | --- | --- | --- |
${harnessFileRows}

## 结论

- [ ] Accept
- [ ] Revise
- [ ] Block

## Summary

本轮迭代的验收结论、关键风险和遗留事项由评估者填写。

## 后续动作

- 缺失的证据：
- 必须补的修复：
- 下次复审触发条件：
`;
}

export function renderCleanStateChecklist(team: TeamConfig): string {
  return `# 干净状态检查清单 -- ${team.projectName}

> 本文件由 Agent Team Studio 生成。提交前和每轮重要会话结束时检查，并把结果作为质量文档的证据。

## 当前快照

- 当前 RUP 阶段：${team.processManagement.currentPhaseId}
- 当前迭代：${currentIterationName(team)}

## Build & Verification

- [ ] \`npm run check\` 通过且没有类型错误
- [ ] \`npm run test\` 通过
- [ ] \`npm run build\` 通过
- [ ] \`bash init.sh\` 通过（如存在）

## Harness Integrity

- [ ] \`AGENTS.team.md\`、\`agents.json\`、\`agents/\` 存在且路由一致
- [ ] \`feature_list.json\` 反映真实功能状态
- [ ] \`progress.md\` 和 \`session-handoff.md\` 已更新
- [ ] \`quality-document.md\`、\`evaluator-rubric.md\` 已填写或明确标注待评估
- [ ] \`bash scripts/cleanup-scanner.sh\` 报告 clean（如存在）

## Architecture Boundaries

- [ ] 渲染层没有直接导入 Node.js 模块（仅当项目是 Electron）
- [ ] IPC channel 只定义在共享类型源中（仅当项目是 Electron）
- [ ] 文件系统和对话框只存在于主进程（仅当项目是 Electron）

## Runtime & Clean State

- [ ] 应用可以启动并进入核心工作流
- [ ] 本地草稿和设置可以重置，且不修改目标项目文件
- [ ] 导出后的 harness 通过落盘校验

## Observability

- [ ] 日志是结构化 JSON 且包含 timestamp、level、service、message
- [ ] 关键操作留下了可复核的日志和证据

## Data & State

- [ ] 没有未记录的半成品状态
- [ ] 当前进度与 \`feature_list.json\` 和 \`progress.md\` 一致
- [ ] 下一轮会话无需人工修复即可继续

## Performance

- [ ] \`bash scripts/benchmark.sh\` 完成全部任务（如存在）
- [ ] 本地分析、导出和验证耗时符合当前项目目标

## Repository

- [ ] git status 没有意外文件
- [ ] 没有敏感数据或密钥被提交
- [ ] 构建产物没有被提交（如 \`dist/\`）
`;
}

export function renderInitScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo "=== Agent Team Studio Harness Init ==="
echo ""

MISSING=false
for file in AGENTS.md CLAUDE.md AGENTS.team.md agents.json feature_list.json progress.md session-handoff.md quality-document.md evaluator-rubric.md clean-state-checklist.md init.sh docs/PROCESS.md; do
  if [ ! -f "$file" ]; then
    echo "  MISSING: $file"
    MISSING=true
  else
    echo "  OK: $file"
  fi
done

if [ "$MISSING" = "true" ]; then
  echo ""
  echo "Some harness files are missing. Fix them before continuing."
  exit 1
fi
echo ""

if [ -f package.json ]; then
  PM="npm"
  if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
    PM="pnpm"
  elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
    PM="yarn"
  elif { [ -f bun.lock ] || [ -f bun.lockb ]; } && command -v bun >/dev/null 2>&1; then
    PM="bun"
  fi

  echo "=== Installing dependencies with $PM ==="
  if ! command -v "$PM" >/dev/null 2>&1; then
    echo "  MISSING: $PM is not installed."
    exit 1
  fi
  "$PM" install
  echo ""

  if command -v node >/dev/null 2>&1; then
    echo "=== Running available verification scripts ==="
    if node -e "const s=require('./package.json').scripts||{};process.exit(s.check?0:1)" >/dev/null 2>&1; then
      "$PM" run check
    fi
    if node -e "const s=require('./package.json').scripts||{};process.exit(s.test?0:1)" >/dev/null 2>&1; then
      "$PM" test
    fi
    if node -e "const s=require('./package.json').scripts||{};process.exit(s.build?0:1)" >/dev/null 2>&1; then
      "$PM" run build
    fi
  else
    echo "  WARN: node is not installed; skipping package script verification."
  fi
else
  echo "No package.json detected."
  echo "Replace this section with the project's verification commands."
fi

echo ""
echo "=== Harness initialization complete. ==="
`;
}
