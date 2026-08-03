import { AgentRole, TeamConfig } from '../shared/types';

export const HARNESS_FILE_PATHS = [
  'AGENTS.md',
  'CLAUDE.md',
  'feature_list.json',
  'progress.md',
  'session-handoff.md',
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
      description: '初始化 RUP harness 文件、多智能体团队配置和规则入口。',
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
- [x] 初始化了 \`AGENTS.md\` 和 \`CLAUDE.md\` 规则入口。

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| 团队配置存在 | \`ls AGENTS.team.md agents.json\` | 待填写 | 由 Agent Team Studio 生成 |
| 角色文件存在 | \`ls agents\` | 待填写 | 每个角色一个文件 |
| Harness 文件存在 | \`ls AGENTS.md CLAUDE.md feature_list.json progress.md init.sh docs/PROCESS.md\` | 待填写 | 缺失时自动创建 |
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

export function renderInitScript(): string {
  return `#!/usr/bin/env bash
set -euo pipefail

echo "=== Agent Team Studio Harness Init ==="
echo ""

MISSING=false
for file in AGENTS.md CLAUDE.md AGENTS.team.md agents.json feature_list.json progress.md session-handoff.md init.sh docs/PROCESS.md; do
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
