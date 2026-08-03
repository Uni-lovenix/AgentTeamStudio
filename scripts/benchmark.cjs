const { performance } = require('perf_hooks');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildTeamConfig } = require('../dist/services/requirement-analyzer.js');
const { ProjectWriter } = require('../dist/services/project-writer.js');
const {
  validateGeneratedHarness,
  validateTeamConfig,
} = require('../dist/services/team-config-validator.js');

const requirements = [
  '一个 React web 应用，需要用户登录、内容管理和权限控制。',
  '一个 Electron 桌面应用，用于导入文档并生成检索索引。',
  '一个基于大模型的多智能体平台，支持任务规划和结果评审。',
  '一个移动端任务清单应用，支持离线同步和团队协作。',
  '一个数据报表后端，支持定时任务、分析和导出。',
];

function measure(fn, runs = 1) {
  const started = performance.now();
  let result;
  for (let i = 0; i < runs; i += 1) {
    result = fn();
  }
  return { result, durationMs: performance.now() - started };
}

const analyze = measure(() => {
  return requirements.map((requirement) =>
    buildTeamConfig({ requirement, projectName: 'benchmark' })
  );
}, 5);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-team-benchmark-'));
const writer = new ProjectWriter();
const write = measure(() => {
  return writer.writeToDirectory(analyze.result[0], dir, true);
}, 10);
const writeResult = write.result;
const harnessFilesPresent = [
  'AGENTS.md',
  'CLAUDE.md',
  'feature_list.json',
  'progress.md',
  'session-handoff.md',
  'init.sh',
  'docs/PROCESS.md',
].every((file) => fs.existsSync(path.join(dir, file)));
const configValidation = validateTeamConfig(analyze.result[0]);
const harnessValidation = validateGeneratedHarness(
  dir,
  analyze.result[0],
  writeResult.createdFiles
);
const agentsRulesMap = fs
  .readFileSync(path.join(dir, 'AGENTS.md'), 'utf-8')
  .includes('## 智能体地图');
const claudeRulesMap = fs
  .readFileSync(path.join(dir, 'CLAUDE.md'), 'utf-8')
  .includes('## 智能体地图');
fs.rmSync(dir, { recursive: true, force: true });

const analyzeAvgMs = analyze.durationMs / 5;
const writeAvgMs = write.durationMs / 10;
const agentCount = analyze.result[0].agents.length;
const roleNames = analyze.result[0].agents.map((agent) => agent.name);
const hasPlanner = roleNames.includes('规划者');
const hasEvaluator = roleNames.includes('评估者');
const hasDeveloper = roleNames.some((name) => name.includes('开发者'));
const hasRoleKinds = analyze.result[0].agents.every((agent) => agent.kind);
const hasSchemaV3 = analyze.result[0].schemaVersion === 3;
const hasProcessManagement = Boolean(analyze.result[0].processManagement);
const hasFourPhases = analyze.result[0].processManagement?.phases?.length === 4;
const hasIterationWorkflow = analyze.result[0].workflow.some((step) =>
  step.name.includes('迭代协议')
);
const hasStartWorkflow = analyze.result[0].workflow.some((step) =>
  step.name.includes('项目启动')
);
const hasEvaluationWorkflow = analyze.result[0].workflow.some((step) =>
  step.name.includes('评估') || step.name.includes('校验') || step.name.includes('验收')
);
const validatePass =
  agentCount >= 3 &&
  hasPlanner &&
  hasEvaluator &&
  hasDeveloper &&
  hasProcessManagement &&
  hasFourPhases &&
  hasIterationWorkflow &&
  hasStartWorkflow &&
  hasEvaluationWorkflow &&
  harnessFilesPresent &&
  configValidation.ok &&
  harnessValidation.ok &&
  agentsRulesMap &&
  claudeRulesMap &&
  hasRoleKinds &&
  hasSchemaV3;
const analyzePass = analyzeAvgMs < 500;
const writePass = writeAvgMs < 100;
const passed = [validatePass, analyzePass, writePass].every(Boolean);

console.log(`[analyze] 5 requirements x5 runs: ${analyze.durationMs.toFixed(1)}ms (${analyzeAvgMs.toFixed(1)}ms avg) ${analyzePass ? 'PASS' : 'FAIL'}`);
console.log(`[write]   10 writes: ${write.durationMs.toFixed(1)}ms (${writeAvgMs.toFixed(1)}ms avg) ${writePass ? 'PASS' : 'FAIL'}`);
console.log(`[validate] generated agents: ${agentCount}, planner=${hasPlanner}, evaluator=${hasEvaluator}, developer=${hasDeveloper}, kinds=${hasRoleKinds}, schemaV3=${hasSchemaV3}, rup=${hasProcessManagement}/${hasFourPhases}, iteration=${hasIterationWorkflow}, start=${hasStartWorkflow}, evaluation=${hasEvaluationWorkflow} ${validatePass ? 'PASS' : 'FAIL'}`);
console.log(`[validate] harness files: ${harnessFilesPresent ? 'PASS' : 'FAIL'}`);
console.log(`[validate] generated harness: ${harnessValidation.ok ? 'PASS' : 'FAIL'}`);
console.log(`[validate] rule maps: AGENTS=${agentsRulesMap}, CLAUDE=${claudeRulesMap} ${agentsRulesMap && claudeRulesMap ? 'PASS' : 'FAIL'}`);
console.log(`=== Summary: ${passed ? '3/3 tasks passed' : 'benchmark failed'} ===`);
process.exit(passed ? 0 : 1);
