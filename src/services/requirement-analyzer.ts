import { v4 as uuidv4 } from 'uuid';
import {
  AgentRoleKind,
  AgentRole,
  EngineeringConventions,
  GenerationLogEntry,
  TeamConfig,
  WorkflowStep,
} from '../shared/types';
import {
  buildProcessManagement,
  normalizeProcessManagement,
} from './process-management';
import { inferAgentRoleKind, isAgentRoleKind } from './agent-role-kind';

export interface RequirementAnalysisContext {
  projectName?: string;
  requirement: string;
  techStackHints?: string;
}

function createRole(
  kind: AgentRoleKind,
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
    kind,
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
  branch: '每个交付责任区块使用独立分支，分支名格式为 feature/<责任区块名>。',
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

interface ConcernRoleSpec {
  key: string;
  name: string;
  mission: string;
  responsibilities: string[];
  skills: string[];
  tools: string[];
  deliverables: string[];
  dependsOn: string[];
  notifies: string[];
  pattern: RegExp;
}

const CONCERN_ROLES: ConcernRoleSpec[] = [
  {
    key: 'account',
    name: '账户与权限开发者',
    mission: '保证身份、账户、权限和数据可见范围完整可审计。',
    responsibilities: [
      '设计注册、登录、认证、会话和找回流程',
      '定义用户、角色、权限与数据隔离规则',
      '梳理异常登录、越权访问和审计需求',
    ],
    skills: ['身份认证', '权限模型', '审计'],
    tools: ['权限矩阵', '认证方案', '审计清单'],
    deliverables: ['账户流程说明', '权限矩阵', '审计清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /登录|注册|认证|身份|账号|账户|用户|会员|权限|授权|oauth|sso|saml/i,
  },
  {
    key: 'transaction',
    name: '交易与支付开发者',
    mission: '保证交易、支付、结算和账务数据在完整生命周期内一致可追踪。',
    responsibilities: [
      '设计订单、支付、退款、结算等状态与流程',
      '明确金额、库存、优惠、发票和异常处理规则',
      '定义交易流水、对账和差错恢复方案',
    ],
    skills: ['交易流程设计', '对账', '异常处理'],
    tools: ['状态机', '支付接口', '对账工具'],
    deliverables: ['交易流程说明', '对账方案', '差错清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /订单|下单|支付|退款|结算|账单|交易|库存|购物车|优惠|价格|发票|对账/i,
  },
  {
    key: 'content',
    name: '内容与审核开发者',
    mission: '保证内容的发布、分类、审核和展示符合产品规则。',
    responsibilities: [
      '明确内容类型、发布流程、分类和标签规则',
      '设计内容审核、举报、下架和恢复机制',
      '定义内容质量、时效和社区秩序标准',
    ],
    skills: ['内容治理', '审核规则', '社区运营'],
    tools: ['内容管理后台', '审核队列'],
    deliverables: ['内容规则', '审核流程', '内容运营方案'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /内容|文章|帖子|社区|评论|审核|发布|分类|标签|ugc|feed|短视频|视频|直播/i,
  },
  {
    key: 'messaging',
    name: '消息与通知开发者',
    mission: '保证关键消息按用户偏好及时、可靠地触达用户。',
    responsibilities: [
      '梳理消息类型、触发时机和接收对象',
      '设计站内信、推送、短信或邮件的优先级与去重规则',
      '定义失败重试、退订和消息追踪方案',
    ],
    skills: ['消息渠道', '触达策略', '失败重试'],
    tools: ['消息模板', '推送/邮件服务'],
    deliverables: ['消息触达方案', '模板清单', '失败处理方案'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /消息|通知|推送|短信|邮件|站内信|提醒|订阅|公告/i,
  },
  {
    key: 'data',
    name: '数据与报表开发者',
    mission: '让项目所需的数据采集、统计、分析和报表可解释可验证。',
    responsibilities: [
      '梳理关键指标、数据口径和报表需求',
      '设计数据采集、清洗、计算和导出流程',
      '定义数据质量检查、权限和异常提示规则',
    ],
    skills: ['数据分析', '指标体系', '数据质量'],
    tools: ['数据看板', '报表工具'],
    deliverables: ['指标定义', '数据流程', '报表样例'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /数据|报表|统计|分析|看板|指标|仪表盘|etl|pipeline/i,
  },
  {
    key: 'ai',
    name: 'AI 与智能体开发者',
    mission: '把模型或智能体能力转化为符合需求、可评估、可兜底的业务能力。',
    responsibilities: [
      '明确模型或智能体要完成的任务、输入输出和约束',
      '设计提示词、工具调用、上下文、评测和兜底策略',
      '定义成本、延迟、安全和结果质量指标',
    ],
    skills: ['LLM 应用', 'Agent 工作流', '评测'],
    tools: ['Prompt 调试', '评测集', '观测工具'],
    deliverables: ['AI 方案', '评测报告', '兜底策略'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /ai|llm|大模型|智能体|agent|模型|推理|prompt|rag|提示词|生成式/i,
  },
  {
    key: 'search',
    name: '搜索与推荐开发者',
    mission: '保证用户能按相关规则快速找到或获得正确内容。',
    responsibilities: [
      '明确搜索或推荐的目标、数据范围和排序规则',
      '设计索引、过滤、排序、分页和空结果处理',
      '定义相关性、准确性、性能与反馈闭环',
    ],
    skills: ['搜索设计', '相关性排序', '检索评测'],
    tools: ['索引方案', '搜索调试工具'],
    deliverables: ['搜索或推荐方案', '评测样例', '兜底结果'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /搜索|检索|索引|查询|过滤|排序|推荐|关键词|全文/i,
  },
  {
    key: 'files',
    name: '文件与同步开发者',
    mission: '保证文件、导入导出和同步过程完整、安全、可恢复。',
    responsibilities: [
      '设计文件上传、下载、格式转换和存储规则',
      '明确导入导出、同步冲突、备份恢复和权限要求',
      '定义大文件、断点续传和失败补偿方案',
    ],
    skills: ['文件存储', '同步策略', '容灾'],
    tools: ['对象存储', '同步协议', '备份方案'],
    deliverables: ['文件流程说明', '同步冲突方案', '备份恢复清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /文件|上传|下载|附件|导入|导出|存储|同步|备份|恢复|文档库/i,
  },
  {
    key: 'security',
    name: '安全与合规开发者',
    mission: '把安全、隐私和合规要求落到功能与运维的每个环节。',
    responsibilities: [
      '识别敏感数据、风险入口和合规要求',
      '设计认证安全、加密、防刷、审计和应急处置',
      '定义安全测试范围与上线前检查清单',
    ],
    skills: ['安全设计', '隐私合规', '风险评估'],
    tools: ['威胁建模', '安全扫描', '审计日志'],
    deliverables: ['安全清单', '合规说明', '应急预案'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /安全|合规|隐私|审计|加密|风险|风控|防刷|防作弊|gdpr|数据保护|敏感/i,
  },
  {
    key: 'performance',
    name: '性能与可用性开发者',
    mission: '保证关键路径的响应、容量和可用性满足目标。',
    responsibilities: [
      '定义性能目标、压测场景和容量基线',
      '设计缓存、限流、降级、监控和告警',
      '建立故障预案、恢复演练和性能回归机制',
    ],
    skills: ['性能工程', '容量规划', '可观测性'],
    tools: ['压测工具', '监控告警', '链路追踪'],
    deliverables: ['性能目标', '压测报告', '应急预案'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /性能|并发|高可用|缓存|限流|延迟|监控|告警|可观测|稳定性|容灾|扩展/i,
  },
  {
    key: 'integration',
    name: '集成与迁移开发者',
    mission: '让外部系统、历史数据和新增能力平滑衔接。',
    responsibilities: [
      '梳理需要对接或迁移的系统、数据和协议',
      '设计接口映射、幂等、重试、兼容和回滚策略',
      '定义迁移校验、切换和回退验收方案',
    ],
    skills: ['系统集成', '迁移设计', '兼容性'],
    tools: ['API 文档', '迁移工具', '校验脚本'],
    deliverables: ['集成方案', '迁移计划', '回滚清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /集成|对接|第三方|接入|迁移|兼容|webhook|插件|历史数据/i,
  },
  {
    key: 'multi-platform',
    name: '多端体验开发者',
    mission: '保证各端在交互、状态和数据一致性上都能完成核心需求。',
    responsibilities: [
      '梳理目标端与设备差异，确定体验优先级',
      '设计各端交互、离线、同步和状态恢复规则',
      '定义端到端验收场景与平台差异处理',
    ],
    skills: ['多端设计', '交互一致性', '端到端验收'],
    tools: ['设计稿', '设备清单', '端到端场景'],
    deliverables: ['多端体验方案', '平台差异清单', '验收场景'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /移动|手机|ios|android|桌面|electron|windows|mac|跨平台|客户端|h5|小程序/i,
  },
  {
    key: 'cli',
    name: '命令行交互开发者',
    mission: '让命令、参数、输出和错误提示对使用者清晰可靠。',
    responsibilities: [
      '定义命令、参数、子命令和帮助信息',
      '设计输入校验、退出码、日志和错误提示',
      '保证脚本化、批量执行和自动化接入',
    ],
    skills: ['CLI 设计', '输入校验', '脚本化'],
    tools: ['终端调试', '命令行规范', '自动化脚本'],
    deliverables: ['命令规范', '帮助文档', '错误码清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /命令行|cli|终端|terminal|脚本工具|批量任务/i,
  },
  {
    key: 'workflow',
    name: '任务与工作流开发者',
    mission: '把需求中的任务、审批、协作和进度管理做得可追踪可完成。',
    responsibilities: [
      '设计任务类型、状态、优先级、负责人和截止时间',
      '定义审批、协作、提醒和进度更新规则',
      '输出任务视图、统计口径和完成判定',
    ],
    skills: ['工作流设计', '任务建模', '进度管理'],
    tools: ['任务看板', '状态机', '工作流引擎'],
    deliverables: ['工作流说明', '任务模型', '进度统计方案'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /任务|工作流|审批|进度|项目管理|协作|待办|todo|kanban|里程碑/i,
  },
  {
    key: 'scheduling',
    name: '定时与异步任务开发者',
    mission: '保证定时、队列和异步任务按规则可靠执行并可观测。',
    responsibilities: [
      '设计定时任务、调度计划、队列和并发约束',
      '定义失败重试、幂等、积压和超时处理',
      '建立任务状态、日志和告警机制',
    ],
    skills: ['任务调度', '队列设计', '失败恢复'],
    tools: ['调度器', '消息队列', '任务监控'],
    deliverables: ['调度方案', '重试策略', '任务观测清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /定时|调度|任务计划|cron|队列|异步|批处理/i,
  },
  {
    key: 'quality',
    name: '测试与质量开发者',
    mission: '把测试、回归和质量门禁组织成可执行的交付保障。',
    responsibilities: [
      '定义测试范围、优先级、环境与数据准备',
      '设计单元、集成、端到端和回归测试',
      '建立缺陷闭环、质量门禁和上线检查',
    ],
    skills: ['测试设计', '自动化测试', '质量门禁'],
    tools: ['测试框架', 'CI/CD', '缺陷管理'],
    deliverables: ['测试计划', '测试报告', '缺陷清单'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /测试|质检|质量|验收|回归|缺陷|覆盖率|ci|持续集成/i,
  },
  {
    key: 'i18n',
    name: '国际化与本地化开发者',
    mission: '保证语言、地区、时区、货币和格式规则在各市场正确。',
    responsibilities: [
      '定义支持语言、地区和本地化内容范围',
      '设计文案、时间、日期、货币和时区规则',
      '建立翻译、回退和质量检查流程',
    ],
    skills: ['国际化设计', '本地化流程', '格式规范'],
    tools: ['文案管理', '翻译流程', '格式测试'],
    deliverables: ['国际化规范', '本地化清单', '回退方案'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /国际化|i18n|多语言|本地化|时区|货币/i,
  },
  {
    key: 'accessibility',
    name: '无障碍与可用性开发者',
    mission: '保证界面信息和关键操作对更多用户可理解、可操作。',
    responsibilities: [
      '识别无障碍目标用户和关键操作路径',
      '设计对比度、键盘、焦点、读屏和响应式规则',
      '定义无障碍检查和回归验证',
    ],
    skills: ['无障碍设计', '可访问性测试', '响应式设计'],
    tools: ['读屏工具', '无障碍审计', '键盘测试'],
    deliverables: ['无障碍规范', '检查清单', '修复记录'],
    dependsOn: ['规划者'],
    notifies: ['评估者'],
    pattern: /无障碍|可访问性|accessibility|a11y|响应式|键盘操作|屏幕阅读/i,
  },
];

function firstMatchPosition(text: string, pattern: RegExp): number {
  const match = new RegExp(pattern.source, pattern.flags).exec(text);
  return match?.index ?? Number.MAX_SAFE_INTEGER;
}

function matchedPhrase(text: string, pattern: RegExp): string | undefined {
  const match = new RegExp(pattern.source, pattern.flags).exec(text);
  return match?.[0];
}

function requirementSnippet(text: string, maxLength = 80): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}...` : trimmed;
}

export function buildTeamConfig(context: RequirementAnalysisContext): TeamConfig {
  const requirement = context.requirement.trim();
  const projectName = context.projectName?.trim() || '未命名项目';
  const techStackHints = parseTechStackHints(context.techStackHints);
  const combinedText = `${requirement}\n${techStackHints.join('\n')}`;
  const generationLog: GenerationLogEntry[] = [
    {
      step: '需求输入',
      detail: '开始读取需求文本并识别需要完成的责任区块。',
      evidence: requirementSnippet(requirement),
    },
    {
      step: '技术栈提示',
      detail: techStackHints.length > 0 ? '技术栈提示会参与角色技能和工具生成。' : '未提供技术栈提示，按需求文本判断。',
      evidence: techStackHints.join('、') || '未提供',
    },
  ];

  const matchedSpecs = CONCERN_ROLES
    .map((spec) => ({ spec, position: firstMatchPosition(combinedText, spec.pattern) }))
    .filter((entry) => entry.position < Number.MAX_SAFE_INTEGER)
    .sort((left, right) => left.position - right.position)
    .map((entry) => entry.spec);

  const roles: AgentRole[] = [];
  const roleIndex = new Map<string, AgentRole>();

  const addRole = (role: AgentRole): void => {
    if (roleIndex.has(role.name)) return;
    roleIndex.set(role.name, role);
    roles.push(role);
  };

  addRole(
    createRole(
      'planner',
      '规划者',
      '把需求拆解为可执行任务，制定方案、流程和迭代协议，并协调开发者完成交付。',
      [
        '把需求或任务拆解为可执行、可验收的开发任务',
        '制定技术方案、交付顺序、依赖关系和流程协调规则',
        '每个迭代开始前制定迭代协议，明确目标、范围、完成标准和退出标准',
        '协调开发者、评估者和文档交接流程，处理阻塞与变更',
      ],
      ['任务拆解', '方案设计', '流程协调'],
      ['迭代协议模板', '任务看板', '依赖清单'],
      ['任务分解', '迭代协议', '流程协调记录'],
      [],
      ['评估者', '开发者', '文档与交接负责人']
    )
  );
  generationLog.push({
    step: '基础角色',
    detail: '每个迭代开始前必须有人负责拆解任务、制定方案和流程，所以生成“规划者”。',
    role: '规划者',
    outcome: '负责任务分解、方案与流程协调，并制定迭代协议',
  });

  addRole(
    createRole(
      'evaluator',
      '评估者',
      '依据迭代协议和退出标准评估开发者的交付结果，发现问题反馈给开发者修改，并确认闭环。',
      [
        '对照迭代协议检查每个迭代的目标、完成标准和交付物',
        '评估开发者生成的结果，记录问题并反馈给对应开发者',
        '复核修复结果，确认通过后进入下一任务或最终验收',
        '汇总评估报告、风险记录和未满足项',
      ],
      ['验收标准', '结果评估', '问题闭环'],
      ['迭代协议', '验收清单', '问题记录'],
      ['评估报告', '问题清单', '修复确认'],
      ['规划者'],
      ['规划者', '开发者', '文档与交接负责人']
    )
  );
  generationLog.push({
    step: '基础角色',
    detail: '开发者交付后必须有人按统一标准校验并反馈，所以生成“评估者”。',
    role: '评估者',
    outcome: '负责按迭代协议校验结果、反馈问题并确认修复',
  });

  for (const spec of matchedSpecs) {
    if (roleIndex.has(spec.name)) continue;
    const phrase = matchedPhrase(combinedText, spec.pattern) ?? spec.key;
    generationLog.push({
      step: '责任识别',
      detail: `需求中出现“${phrase}”，所以匹配“${spec.name}”责任区块。`,
      evidence: phrase,
      role: spec.name,
      outcome: '命中责任区块',
    });
    generationLog.push({
      step: '角色生成',
      detail: `根据“${phrase}”创建“${spec.name}”角色。`,
      evidence: spec.mission,
      role: spec.name,
      outcome: `职责：${spec.responsibilities.join('；')}`,
    });
    const responsibilities = [
      ...spec.responsibilities,
      phrase ? `围绕需求中的“${phrase}”落实可验收交付。` : '按迭代协议完成本责任区块的开发、测试与交付物。',
      '根据评估者反馈修改问题，直到通过校验。',
    ];
    addRole(
      createRole(
        'developer',
        spec.name,
        spec.mission,
        responsibilities,
        spec.skills,
        spec.tools,
        spec.deliverables,
        spec.dependsOn,
        spec.notifies
      )
    );
  }

  if (!roles.some((role) => role.kind === 'developer')) {
    addRole(
      createRole(
        'developer',
        '开发者',
        '按规划者制定的迭代协议完成开发、测试和交付物，并根据评估者反馈修复问题。',
        [
          '阅读并执行迭代协议中的任务目标、范围和完成标准',
          '完成本任务实现、测试与必要文档',
          '根据评估者反馈修改问题，直到通过校验',
        ],
        ['需求实现', '代码质量', '问题修复'],
        ['开发环境', '测试工具', '迭代协议'],
        ['实现代码', '测试结果', '变更说明'],
        ['规划者'],
        ['评估者']
      )
    );
    generationLog.push({
      step: '基础角色',
      detail: '当前需求未命中具体责任区块，为保证有执行者所以生成“开发者”。',
      role: '开发者',
      outcome: '负责按迭代协议开发并根据评估者反馈修改',
    });
  }

  addRole(
    createRole(
      'documentation',
      '文档与交接负责人',
      '把需求、决策、接口和运行方式沉淀成可持续交接的文档。',
      [
        '维护需求、架构、接口和运行说明',
        '整理验收记录、交付说明和已知问题',
        '保证新角色能依据文档继续接手',
      ],
      ['技术写作', '文档结构设计', '交付交接'],
      ['Markdown', '知识库工具'],
      ['项目文档', '交付说明', '交接清单'],
      ['规划者', '评估者'],
      ['规划者']
    )
  );
  generationLog.push({
    step: '基础角色',
    detail: '交付结果需要能被后续角色接手，所以生成“文档与交接负责人”。',
    role: '文档与交接负责人',
    outcome: '负责沉淀需求、接口、运行说明和交付清单',
  });

  const finalRoles = roles.map((role) => ({
    ...role,
    dependsOn: role.dependsOn.filter((name) => name !== role.name && roleIndex.has(name)),
    notifies: role.notifies.filter((name) => name !== role.name && roleIndex.has(name)),
  }));
  const finalRoleIndex = new Map(finalRoles.map((role) => [role.name, role]));
  const finalRoleById = new Map(finalRoles.map((role) => [role.id, role]));

  const plannerRole = finalRoleIndex.get('规划者') ?? finalRoles[0];
  const evaluatorRole = finalRoleIndex.get('评估者') ?? finalRoles[0];
  const docsRole = finalRoleIndex.get('文档与交接负责人') ?? finalRoles[0];
  const primaryDeveloperRole =
    finalRoles.find((role) => role.name.includes('开发者')) ?? finalRoles[0];

  const workflow: WorkflowStep[] = [
    {
      id: 'project-start',
      name: '项目启动',
      description: '规划者确认项目边界、目标、关键约束和初始风险，并制定首个迭代计划。',
      ownerRoleId: plannerRole.id,
    },
    {
      id: 'iteration-protocol',
      name: '制定迭代协议',
      description: '规划者在每个迭代开始前制定迭代协议，明确目标、范围、计划、完成标准、交付物和退出标准。',
      ownerRoleId: plannerRole.id,
    },
    {
      id: 'iteration-development',
      name: '迭代开发',
      description: '各开发者按规划者制定的迭代协议完成实现、测试和交付物。',
      ownerRoleId: primaryDeveloperRole.id,
    },
    {
      id: 'evaluation-feedback',
      name: '评估与反馈',
      description: '评估者按迭代协议和退出标准校验开发者交付；发现问题反馈给对应开发者修改，通过后进入下一迭代。',
      ownerRoleId: evaluatorRole.id,
    },
    {
      id: 'iteration-review',
      name: '迭代复盘',
      description: '规划者汇总迭代结果、风险、反馈和未满足项，决定下一迭代或阶段是否开始。',
      ownerRoleId: plannerRole.id,
    },
    {
      id: 'phase-acceptance',
      name: '阶段验收',
      description: '评估者核对当前 RUP 阶段的里程碑和退出标准，通过后进入下一阶段。',
      ownerRoleId: evaluatorRole.id,
    },
    {
      id: 'transition-acceptance',
      name: '移交验收',
      description: '完成最终验收、文档交接和已知问题移交。',
      ownerRoleId: docsRole.id,
    },
  ];
  generationLog.push({
    step: '协作流程',
    detail: `根据角色生成协作流程：${workflow.map((step) => step.name).join(' → ')}。`,
    evidence: `共 ${workflow.length} 个步骤`,
    outcome: workflow
      .map(
        (step) =>
          `${step.name}：${finalRoleById.get(step.ownerRoleId)?.name ?? '待分配'}`
      )
      .join('；'),
  });

  const processManagement = buildProcessManagement(
    finalRoles,
    requirement,
    techStackHints
  );

  return {
    schemaVersion: 3,
    projectName,
    requirement,
    techStackHints,
    generatedBy: 'local',
    createdAt: new Date().toISOString(),
    workflow,
    agents: finalRoles,
    processManagement,
    conventions: DEFAULT_CONVENTIONS,
    generationLog,
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
  const name =
    typeof value.name === 'string' && value.name ? value.name : `角色 ${index + 1}`;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `role-${index + 1}`,
    kind: isAgentRoleKind(value.kind) ? value.kind : inferAgentRoleKind(name),
    name,
    mission: typeof value.mission === 'string' ? value.mission : '负责对应的项目职责。',
    responsibilities: asStringArray(value.responsibilities, []),
    skills: asStringArray(value.skills, []),
    tools: asStringArray(value.tools, []),
    deliverables: asStringArray(value.deliverables, []),
    dependsOn: asStringArray(value.dependsOn, []),
    notifies: asStringArray(value.notifies, []),
  };
}

export function dedupeAgentIds(agents: AgentRole[]): AgentRole[] {
  const usedIds = new Set<string>();
  return agents.map((agent, index) => {
    let id = agent.id;
    while (usedIds.has(id)) {
      id = `${agent.id}-${index + 1}`;
    }
    usedIds.add(id);
    return { ...agent, id };
  });
}

function fallbackRoleByKind(fallback: TeamConfig, kind: AgentRoleKind): AgentRole {
  return fallback.agents.find((agent) => agent.kind === kind) ?? fallback.agents[0];
}

function enforceMandatoryRoles(
  agents: AgentRole[],
  fallback: TeamConfig
): { agents: AgentRole[]; addedRoleNames: string[] } {
  const result = [...agents];
  const addedRoleNames: string[] = [];
  const addIfMissing = (kind: AgentRoleKind): void => {
    if (result.some((agent) => agent.kind === kind)) return;
    const role = fallbackRoleByKind(fallback, kind);
    result.unshift(role);
    addedRoleNames.push(role.name);
  };

  addIfMissing('planner');
  addIfMissing('evaluator');
  if (!result.some((agent) => agent.kind === 'developer')) {
    const developer = fallbackRoleByKind(fallback, 'developer');
    result.push(developer);
    addedRoleNames.push(developer.name);
  }

  return { agents: result, addedRoleNames };
}

export const RUP_WORKFLOW_STEPS: Array<Omit<WorkflowStep, 'ownerRoleId'>> = [
  {
    id: 'project-start',
    name: '项目启动',
    description: '规划者确认项目边界、目标、关键约束和初始风险，并制定首个迭代计划。',
  },
  {
    id: 'iteration-protocol',
    name: '制定迭代协议',
    description: '规划者在每个迭代开始前制定迭代协议，明确目标、范围、计划、完成标准、交付物和退出标准。',
  },
  {
    id: 'iteration-development',
    name: '迭代开发',
    description: '各开发者按规划者制定的迭代协议完成实现、测试和交付物。',
  },
  {
    id: 'evaluation-feedback',
    name: '评估与反馈',
    description: '评估者按迭代协议和退出标准校验开发者交付；发现问题反馈给对应开发者修改，通过后进入下一迭代。',
  },
  {
    id: 'iteration-review',
    name: '迭代复盘',
    description: '规划者汇总迭代结果、风险、反馈和未满足项，决定下一迭代或阶段是否开始。',
  },
  {
    id: 'phase-acceptance',
    name: '阶段验收',
    description: '评估者核对当前 RUP 阶段的里程碑和退出标准，通过后进入下一阶段。',
  },
  {
    id: 'transition-acceptance',
    name: '移交验收',
    description: '完成最终验收、文档交接和已知问题移交。',
  },
];

export function ensureRupWorkflow(steps: WorkflowStep[], agents: AgentRole[]): WorkflowStep[] {
  const roleIdByKind = (kind: AgentRoleKind): string =>
    agents.find((agent) => agent.kind === kind)?.id ?? agents[0]?.id ?? '';
  const plannerId = roleIdByKind('planner');
  const evaluatorId = roleIdByKind('evaluator');
  const docsId = roleIdByKind('documentation') || evaluatorId;
  const developerId =
    agents.find((agent) => agent.kind === 'developer')?.id ?? agents[0]?.id ?? '';

  const result = steps.map((step) => ({
    ...step,
    name: step.name.replace(/冲刺协议/g, '迭代协议').replace(/按冲刺/g, '按迭代'),
    description: step.description
      .replace(/冲刺协议/g, '迭代协议')
      .replace(/每项任务/g, '每个迭代')
      .replace(/按冲刺/g, '按迭代'),
  }));

  for (const definition of RUP_WORKFLOW_STEPS) {
    if (result.some((step) => step.name.includes(definition.name))) continue;
    const ownerRoleId =
      definition.id === 'iteration-development'
        ? developerId
        : definition.id === 'evaluation-feedback' ||
            definition.id === 'phase-acceptance'
          ? evaluatorId
          : definition.id === 'transition-acceptance'
            ? docsId
            : plannerId;
    result.push({ ...definition, ownerRoleId });
  }

  return result
    .map((step) => ({
      ...step,
      ownerRoleId:
        agents.some((agent) => agent.id === step.ownerRoleId)
          ? step.ownerRoleId
          : agents[0]?.id ?? '',
    }))
    .slice(0, 12);
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
  const enforced = enforceMandatoryRoles(agents, fallback);
  const dedupedAgents = dedupeAgentIds(enforced.agents);
  const rawWorkflow = Array.isArray(value.workflow) ? value.workflow : fallback.workflow;
  const generationLog: GenerationLogEntry[] = [];
  if (Array.isArray(value.agents) && value.agents.length > 0) {
    generationLog.push({
      step: 'LLM 解析',
      detail: `LLM 返回 ${value.agents.length} 个角色，已校验、去重并补齐必需角色。`,
      evidence: dedupedAgents.map((agent) => agent.name).join('、'),
      outcome: `保留 ${dedupedAgents.length} 个角色`,
    });
  } else {
    generationLog.push({
      step: 'LLM 兜底',
      detail: 'LLM 未返回有效角色数组，所以改用本地需求驱动生成。',
      evidence: 'agents 字段缺失或为空',
      outcome: `回退角色：${fallback.agents.map((agent) => agent.name).join('、')}`,
    });
  }
  if (enforced.addedRoleNames.length > 0) {
    generationLog.push({
      step: '强制角色',
      detail: `LLM 结果缺少必需协作角色，已补充 ${enforced.addedRoleNames.join('、')}。`,
      evidence: enforced.addedRoleNames.join('、'),
      outcome: `最终角色：${dedupedAgents.map((agent) => agent.name).join('、')}`,
    });
  }
  generationLog.push({
    step: '结构校验',
    detail: '缺失字段已补齐，协作流程和工程约定已标准化。',
    evidence: '技能、工具、交付物、约定等字段',
    outcome: 'TeamConfig 已标准化',
  });
  const processManagement = normalizeProcessManagement(
    value.processManagement,
    fallback.processManagement,
    dedupedAgents
  );
  generationLog.push({
    step: 'RUP 过程',
    detail: '过程管理已标准化为启动、细化、构建、移交四个阶段，并为每个阶段保留迭代与退出标准。',
    evidence: processManagement.phases.map((phase) => phase.name).join('、'),
    outcome: `当前阶段：${processManagement.currentPhaseId}，共 ${processManagement.iterations.length} 个迭代`,
  });
  const workflow: WorkflowStep[] = ensureRupWorkflow(
    rawWorkflow
    .map((step, index) => {
      const item = (step ?? {}) as Record<string, unknown>;
      return {
        id: typeof item.id === 'string' && item.id ? item.id : `step-${index + 1}`,
        name: typeof item.name === 'string' && item.name ? item.name : `步骤 ${index + 1}`,
        description: typeof item.description === 'string' ? item.description : '',
        ownerRoleId: typeof item.ownerRoleId === 'string' ? item.ownerRoleId : dedupedAgents[0]?.id ?? '',
      };
    })
    .slice(0, 8),
    dedupedAgents
  );
  const rawConventions = (value.conventions ?? {}) as Record<string, unknown>;

  return {
    schemaVersion: 3,
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
    processManagement,
    generationLog,
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
