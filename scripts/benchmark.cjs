const { performance } = require('perf_hooks');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildTeamConfig } = require('../dist/services/requirement-analyzer.js');
const { ProjectWriter } = require('../dist/services/project-writer.js');

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
  writer.writeToDirectory(analyze.result[0], dir, true);
}, 10);
fs.rmSync(dir, { recursive: true, force: true });

const analyzeAvgMs = analyze.durationMs / 5;
const writeAvgMs = write.durationMs / 10;
const agentCount = analyze.result[0].agents.length;
const validatePass = agentCount >= 3;
const analyzePass = analyzeAvgMs < 500;
const writePass = writeAvgMs < 100;
const passed = [validatePass, analyzePass, writePass].every(Boolean);

console.log(`[analyze] 5 requirements x5 runs: ${analyze.durationMs.toFixed(1)}ms (${analyzeAvgMs.toFixed(1)}ms avg) ${analyzePass ? 'PASS' : 'FAIL'}`);
console.log(`[write]   10 writes: ${write.durationMs.toFixed(1)}ms (${writeAvgMs.toFixed(1)}ms avg) ${writePass ? 'PASS' : 'FAIL'}`);
console.log(`[validate] generated agents: ${agentCount} ${validatePass ? 'PASS' : 'FAIL'}`);
console.log(`=== Summary: ${passed ? '3/3 tasks passed' : 'benchmark failed'} ===`);
process.exit(passed ? 0 : 1);
